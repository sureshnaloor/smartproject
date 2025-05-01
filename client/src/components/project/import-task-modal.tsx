import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { WbsItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { parseCsvFile } from "@/lib/csv";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileUp, FileX, Download, AlertTriangle, X, AlertCircle } from "lucide-react";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ImportActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  workPackageId: number | null;
}

// Form schema
const formSchema = z.object({
  csvFile: z.instanceof(FileList).refine(
    (files) => files.length === 1,
    "Please select a CSV file"
  ),
});

type FormValues = z.infer<typeof formSchema>;

// Function to download the activity template
const downloadActivityTemplate = () => {
  const csvContent = [
    "activityCode,activityName,description,startDate,duration,endDate,percentComplete",
    "1.1.1,Design Phase,Initial design activities,2024-01-01,10,,0",
    "1.1.2,Development Phase,Implementation work,2024-01-15,,2024-01-30,0",
    "1.1.3,Testing Phase,Quality assurance,2024-02-01,5,,0"
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "activity_import_template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Custom function to parse CSV for activities
const parseActivityCsvFile = async (file: File): Promise<{ data: any[]; errors: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== "string") {
        return reject(new Error("Failed to read file as text"));
      }
      
      try {
        // Remove Byte Order Mark (BOM) if present
        const cleanText = text.replace(/^\uFEFF/, '');
        
        // Split by any line ending and filter empty lines
        const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== "");
        
        if (lines.length === 0) {
          return resolve({
            data: [],
            errors: ["CSV file is empty or contains no valid data"]
          });
        }
        
        const headers = lines[0].split(",").map(header => header.trim());
        
        // Check if required activity columns exist
        const requiredColumns = ["activityCode", "activityName", "startDate"];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        
        if (missingColumns.length > 0) {
          return resolve({
            data: [],
            errors: [`Missing required activity columns: ${missingColumns.join(", ")}. Make sure you're using an activity CSV template, not a WBS template.`]
          });
        }
        
        const data: Record<string, string>[] = [];
        const errors: string[] = [];
        
        // Skip header row
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const values = line.split(",").map(value => value.trim());
          
          // Handle cases where values might contain commas inside quotes
          const row: Record<string, string> = {};
          
          headers.forEach((header, index) => {
            row[header] = values[index] || "";
          });
          
          data.push(row);
        }
        
        resolve({ data, errors });
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Unknown error parsing CSV"));
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Error reading file"));
    };
    
    reader.readAsText(file);
  });
};

interface Task {
  id?: number;
  activityId: number;
  name: string;
  description?: string;
  startDate?: string | null;
  endDate?: string | null;
  duration?: number;
  percentComplete?: number;
  dependencies?: { predecessorId: number; successorId: number; type: string; lag: number }[];
}

interface ImportTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (tasks: Task[]) => void;
  activities: WbsItem[];
}

export function ImportTaskModal({ isOpen, onClose, onImport, activities }: ImportTaskModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<Task[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetModal = () => {
    setFile(null);
    setError(null);
    setParsedData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      setFile(null);
      return;
    }
    
    setFile(selectedFile);
    setError(null);
    
    // Parse the CSV file
    parseTaskCsvFile(selectedFile, activities)
      .then(result => {
        if (result.errors.length > 0) {
          setError(`Invalid CSV format: ${result.errors.join(', ')}`);
        } else {
          setParsedData(result.data);
        }
      })
      .catch(err => {
        console.error('Error parsing CSV:', err);
        setError('Failed to parse CSV file. Please check the format and try again.');
      });
  };

  const handleImport = async () => {
    if (!parsedData.length) {
      setError('No valid data to import. Please check your CSV file.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // In a real implementation, you might want to call an API here
      onImport(parsedData);
      resetModal();
      onClose();
    } catch (err) {
      console.error('Error importing tasks:', err);
      setError('Failed to import tasks. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      
      // Parse the CSV file
      parseTaskCsvFile(droppedFile, activities)
        .then(result => {
          if (result.errors.length > 0) {
            setError(`Invalid CSV format: ${result.errors.join(', ')}`);
          } else {
            setParsedData(result.data);
          }
        })
        .catch(err => {
          console.error('Error parsing CSV:', err);
          setError('Failed to parse CSV file. Please check the format and try again.');
        });
    }
  };

  const downloadTaskTemplate = () => {
    const activityOptionsContent = activities
      .map(a => `${a.id},${a.name}`)
      .join('\n');

    const headers = 'name,description,activityId,startDate,endDate,duration,percentComplete';
    const sampleData = `Task 1,Sample task description 1,${activities[0]?.id || 0},2023-05-01,2023-05-10,10,0
Task 2,Sample task description 2,${activities[0]?.id || 0},2023-05-11,2023-05-20,10,50
Task 3,Sample task description 3,${activities[0]?.id || 0},2023-05-21,2023-05-30,10,100`;
    
    const csvContent = `${headers}\n${sampleData}`;
    const activityOptionsNote = `\n\n# Available Activities (reference only, do not include in import):\n# ID,Name\n${activityOptionsContent}`;
    
    const fullContent = csvContent + activityOptionsNote;
    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'task_import_template.csv');
    link.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) resetModal();
      onClose();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Tasks</DialogTitle>
          <DialogDescription>
            Upload a CSV file with task data to import multiple tasks at once. 
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div 
          className="grid grid-cols-1 gap-4"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <FileUp className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-900">Click to upload or drag and drop</p>
              <p className="text-xs text-gray-500">CSV up to 10MB</p>
            </div>
          </div>

          {file && (
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
              <div className="flex items-center space-x-2">
                <div className="flex-shrink-0">
                  <FileUp className="h-5 w-5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{Math.round(file.size / 1024)} KB</p>
                </div>
              </div>
              <button
                type="button"
                className="p-1 rounded-md text-gray-400 hover:text-gray-500"
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                <span className="sr-only">Remove file</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}

          <div className="text-sm text-gray-500 mt-2">
            <p className="font-semibold mb-1">Required columns:</p>
            <ul className="list-disc pl-5">
              <li>name - Name of the task</li>
              <li>activityId - The ID of the activity this task belongs to</li>
              <li>startDate - Start date in YYYY-MM-DD format</li>
              <li>Either duration (in days) or endDate must be provided</li>
            </ul>
            <p className="mt-2">Need help? Download a template to get started:</p>
            <Button variant="outline" size="sm" className="mt-1" onClick={downloadTaskTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!file || isLoading || !parsedData.length}
            className={isLoading ? 'opacity-50 cursor-not-allowed' : ''}
          >
            {isLoading ? 'Importing...' : 'Import Tasks'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Custom function to parse CSV for tasks
async function parseTaskCsvFile(file: File, activities: WbsItem[]): Promise<{ data: Task[], errors: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const result: { data: Task[], errors: string[] } = { data: [], errors: [] };
    
    reader.onload = (e) => {
      try {
        const contents = e.target?.result as string;
        
        // Handle UTF-8 BOM
        const cleanContents = contents.replace(/^\uFEFF/, '');
        
        // Split by line breaks
        const lines = cleanContents.split(/\r\n|\n/).filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
          result.errors.push('CSV file must contain a header row and at least one data row');
          resolve(result);
          return;
        }
        
        // Extract headers and convert to lowercase
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        // Check required columns
        const requiredColumns = ['name', 'activityid'];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        
        if (missingColumns.length > 0) {
          result.errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
          resolve(result);
          return;
        }
        
        // Process data rows
        const activityIds = activities.map(a => a.id);
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (line.trim() === '' || line.startsWith('#')) continue; // Skip empty lines or comments
          
          const values = line.split(',');
          if (values.length !== headers.length) {
            result.errors.push(`Line ${i + 1} has ${values.length} columns, but header has ${headers.length} columns`);
            continue;
          }
          
          const rowData: any = {};
          headers.forEach((header, index) => {
            rowData[header] = values[index].trim();
          });
          
          // Validate required fields
          if (!rowData.name) {
            result.errors.push(`Line ${i + 1}: Missing task name`);
            continue;
          }
          
          const activityId = parseInt(rowData.activityid);
          if (isNaN(activityId) || !activityIds.includes(activityId)) {
            result.errors.push(`Line ${i + 1}: Invalid or unknown activity ID ${rowData.activityid}`);
            continue;
          }
          
          // Validate that either duration or endDate is provided if startDate is provided
          if (rowData.startdate && !rowData.duration && !rowData.enddate) {
            result.errors.push(`Line ${i + 1}: Either duration or endDate must be provided`);
            continue;
          }
          
          // Convert values to appropriate types
          const task: Task = {
            name: rowData.name,
            activityId: activityId,
            description: rowData.description || '',
            startDate: rowData.startdate || null,
            endDate: rowData.enddate || null,
            duration: rowData.duration ? parseInt(rowData.duration) : undefined,
            percentComplete: rowData.percentcomplete ? parseInt(rowData.percentcomplete) : 0
          };
          
          result.data.push(task);
        }
        
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
} 