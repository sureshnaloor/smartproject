import { useState, useEffect } from "react";
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
import { FileUp, FileX, Download, AlertTriangle } from "lucide-react";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    "1.1.1.1,Design Phase,Initial design activities,2024-01-01,10,,0",
    "1.1.1.2,Development Phase,Implementation work,2024-01-15,,2024-01-30,0",
    "1.1.1.3,Testing Phase,Quality assurance,2024-02-01,5,,0"
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

export function ImportActivityModal({ isOpen, onClose, projectId, workPackageId }: ImportActivityModalProps) {
  const [csvData, setCsvData] = useState<any[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isParsingComplete, setIsParsingComplete] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(workPackageId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset selectedPackageId when workPackageId changes
  useEffect(() => {
    setSelectedPackageId(workPackageId);
  }, [workPackageId]);

  // Fetch WBS items for reference
  const { data: wbsItems = [] } = useQuery<WbsItem[]>({
    queryKey: [`/api/projects/${projectId}/wbs`],
    enabled: isOpen,
  });

  // Get all available work packages
  const workPackages = wbsItems.filter(item => item.type === "WorkPackage");

  // Get parent Work Package
  const parentWorkPackage = selectedPackageId 
    ? wbsItems.find(item => item.id === selectedPackageId) 
    : null;

  // Create form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      csvFile: undefined,
    },
  });

  // Handle file selection
  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    try {
      setCsvData([]);
      setParseErrors([]);
      setIsParsingComplete(false);
      
      // Use our custom activity CSV parser
      const { data, errors } = await parseActivityCsvFile(file);
      
      // Validate activities and add any specific errors
      const validationErrors: string[] = [];
      data.forEach((row, index) => {
        if (!row.activityCode) {
          validationErrors.push(`Row ${index + 1}: Missing required field 'activityCode'`);
        }
        if (!row.activityName) {
          validationErrors.push(`Row ${index + 1}: Missing required field 'activityName'`);
        }
        if (!row.startDate) {
          validationErrors.push(`Row ${index + 1}: Missing required field 'startDate'`);
        }
        if (!row.duration && !row.endDate) {
          validationErrors.push(`Row ${index + 1}: Either 'duration' or 'endDate' must be provided`);
        }
      });
      
      setCsvData(data);
      setParseErrors([...errors, ...validationErrors]);
      setIsParsingComplete(true);
      
      if (errors.length > 0 || validationErrors.length > 0) {
        toast({
          title: "CSV Validation Errors",
          description: `${errors.length + validationErrors.length} errors found in the CSV file.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error Parsing CSV",
        description: error instanceof Error ? error.message : "Failed to parse CSV file",
        variant: "destructive",
      });
    }
  };

  // Import activities mutation
  const importActivities = useMutation({
    mutationFn: async (data: any[]) => {
      if (!selectedPackageId) {
        throw new Error("Please select a Work Package to import activities into");
      }

      try {
        // Transform data to match the API expectations
        const transformedData = data.map(row => ({
          code: row.activityCode,
          name: row.activityName,
          description: row.description || "",
          startDate: row.startDate,
          endDate: row.endDate,
          duration: row.duration ? Number(row.duration) : undefined,
          percentComplete: row.percentComplete ? Number(row.percentComplete) : 0,
          parentId: selectedPackageId,
          projectId: projectId
        }));
        
        console.log('Sending import request with data:', {
          projectId,
          workPackageId: selectedPackageId,
          csvData: transformedData,
        });
        
        try {
          // Try the detailed endpoint format first
          const response = await apiRequest("POST", `/api/projects/${projectId}/wbs/${selectedPackageId}/activities/import`, {
            projectId,
            workPackageId: selectedPackageId,
            csvData: transformedData,
          });
          
          console.log('Import response from detailed endpoint:', response);
          return response.json();
        } catch (apiError) {
          console.error('API request to detailed endpoint failed:', apiError);
          
          // Try the project-level endpoint
          console.log('Trying project-level endpoint...');
          try {
            const projectResponse = await apiRequest("POST", `/api/projects/${projectId}/wbs/activities/import`, {
              projectId,
              workPackageId: selectedPackageId,
              csvData: transformedData,
            });
            
            console.log('Import response from project endpoint:', projectResponse);
            return projectResponse.json();
          } catch (projectError) {
            console.error('API request to project endpoint failed:', projectError);
            
            // Try the original endpoint as a last resort
            console.log('Trying original endpoint...');
            const fallbackResponse = await apiRequest("POST", "/api/wbs/activities/import", {
              projectId,
              workPackageId: selectedPackageId,
              csvData: transformedData,
            });
            
            console.log('Import response from original endpoint:', fallbackResponse);
            return fallbackResponse.json();
          }
        }
      } catch (error) {
        console.error("CSV import error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('Import success:', data);
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/wbs`] });
      toast({
        title: "Import Successful",
        description: `${csvData.length} activities have been imported.`,
        variant: "default",
      });
      handleClose();
    },
    onError: (error: any) => {
      console.error("Import error details:", error);
      
      let errorMessage = "Failed to import activities. Please check your CSV file and the API endpoint.";
      let errorDetails: string[] = [];
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      if (error.errors && Array.isArray(error.errors)) {
        errorMessage = `${error.errors.length} validation errors found. Please check your CSV file.`;
        errorDetails = error.errors;
      }
      
      // Check for network errors
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        errorMessage = "Network error: Could not connect to the server. Is the API server running?";
      }
      
      toast({
        title: "Import Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      if (errorDetails.length > 0) {
        setParseErrors(errorDetails);
        setIsParsingComplete(true);
      }
    },
  });

  // Handle form submission
  const onSubmit = (values: FormValues) => {
    if (!selectedPackageId) {
      toast({
        title: "Work Package Required",
        description: "Please select a Work Package to import activities into",
        variant: "destructive",
      });
      return;
    }

    if (csvData.length === 0) {
      toast({
        title: "No Data",
        description: "No valid data to import. Please check your CSV file.",
        variant: "destructive",
      });
      return;
    }
    
    if (parseErrors.length > 0) {
      toast({
        title: "Validation Errors",
        description: "Please fix errors in your CSV file before importing.",
        variant: "destructive",
      });
      return;
    }
    
    importActivities.mutate(csvData);
  };

  // Handle modal close
  const handleClose = () => {
    form.reset();
    setCsvData([]);
    setParseErrors([]);
    setIsParsingComplete(false);
    // Don't reset selectedPackageId here to maintain the selection
    onClose();
  };

  // Check for duplicate codes
  const hasDuplicateCodes = () => {
    const codes = csvData.map(row => row.activityCode);
    return new Set(codes).size !== codes.length;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Activities</DialogTitle>
          <DialogDescription>
            Upload a CSV file with activities to create or update. Download the template to see the required format.
          </DialogDescription>
        </DialogHeader>

        <Alert className="mb-4">
          <AlertDescription>
            <p className="mb-1 font-semibold">Import Requirements:</p>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li><strong>Required columns:</strong> activityCode, activityName, startDate, and either duration or endDate</li>
              <li><strong>Optional columns:</strong> description, percentComplete</li>
              <li>Date format must be YYYY-MM-DD</li>
              <li>Duration should be a number of days</li>
              <li>Activities will be created as children of the selected Work Package</li>
              <li>Activities with existing codes will be updated instead of created</li>
              <li className="font-medium text-blue-600">Use the Download Template button to get the correct CSV format</li>
              {parentWorkPackage ? (
                <li className="text-blue-600">Importing activities for: {parentWorkPackage.name} ({parentWorkPackage.code})</li>
              ) : (
                <li className="text-amber-600">Please select a Work Package below</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>

        {/* Work Package selector - only show when workPackageId is not provided */}
        {!workPackageId && (
          <div className="mb-6">
            <Label htmlFor="workPackage">Select Work Package</Label>
            <Select
              value={selectedPackageId?.toString() || "placeholder"}
              onValueChange={(value) => {
                if (value === "placeholder") {
                  setSelectedPackageId(null);
                } else {
                  setSelectedPackageId(Number(value));
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a Work Package" />
              </SelectTrigger>
              <SelectContent>
                {selectedPackageId ? null : (
                  <SelectItem value="placeholder" disabled>Choose a Work Package</SelectItem>
                )}
                {workPackages.map((wp) => (
                  <SelectItem key={wp.id} value={wp.id.toString()}>
                    {wp.code} - {wp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              Select the Work Package that will contain these activities
            </p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex justify-between items-start">
              <FormField
                control={form.control}
                name="csvFile"
                render={({ field: { onChange, value, ...rest } }) => (
                  <FormItem className="flex-1 mr-4">
                    <FormLabel>Upload CSV File</FormLabel>
                    <FormControl>
                      <div className="flex items-center">
                        <Input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            onChange(e.target.files);
                            handleFileChange(e.target.files);
                          }}
                          {...rest}
                        />
                        {value && value.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="ml-2"
                            onClick={() => {
                              onChange(undefined);
                              setCsvData([]);
                              setParseErrors([]);
                              setIsParsingComplete(false);
                            }}
                          >
                            <FileX className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      Upload a CSV file with activity details to create or update
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                variant="outline"
                className="mt-8"
                onClick={downloadActivityTemplate}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>

            <Alert className="mb-4 border-yellow-300 bg-yellow-50">
              <AlertDescription className="flex">
                <AlertTriangle className="h-5 w-5 mr-2 text-amber-600 flex-shrink-0" />
                <p className="text-sm">
                  <strong>Important:</strong> All activities will be created as type "Activity" and added under the selected
                  Work Package. Activities must have a start date and either a duration or end date.
                </p>
              </AlertDescription>
            </Alert>

            {parseErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="font-semibold mb-1">Errors found in CSV file:</div>
                  <ul className="list-disc pl-5 text-sm space-y-1 max-h-[100px] overflow-y-auto">
                    {parseErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {hasDuplicateCodes() && (
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="font-semibold">Duplicate activity codes detected</div>
                  <p className="text-sm">Your CSV contains duplicate activity codes. Each activity must have a unique code.</p>
                </AlertDescription>
              </Alert>
            )}

            {isParsingComplete && csvData.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Preview ({csvData.length} items)</h4>
                <div className="border rounded-md overflow-hidden max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>% Complete</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.map((row, index) => {
                        // Find existing activity with matching code under this work package
                        const existingActivity = wbsItems.find(item => 
                          item.code === row.activityCode && 
                          item.type === "Activity" &&
                          (selectedPackageId ? item.parentId === selectedPackageId : true)
                        );
                        
                        // Check for invalid data
                        const isValid = row.activityCode && row.activityName && row.startDate && (row.duration || row.endDate);
                        
                        return (
                          <TableRow 
                            key={index} 
                            className={!isValid 
                              ? "bg-red-50" 
                              : existingActivity 
                                ? "bg-yellow-50" 
                                : undefined
                            }
                          >
                            <TableCell>{row.activityCode || '-'}</TableCell>
                            <TableCell>{row.activityName || '-'}</TableCell>
                            <TableCell>{row.startDate || '-'}</TableCell>
                            <TableCell>{row.endDate || '-'}</TableCell>
                            <TableCell>{row.duration || '-'}</TableCell>
                            <TableCell>{row.percentComplete || '0'}</TableCell>
                            <TableCell>
                              {!isValid ? (
                                <Badge variant="destructive" className="text-xs">Invalid</Badge>
                              ) : existingActivity ? (
                                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs border-yellow-200">Update</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-green-100 text-green-800 text-xs border-green-200">New</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={
                  importActivities.isPending || 
                  csvData.length === 0 || 
                  parseErrors.length > 0 ||
                  hasDuplicateCodes() ||
                  !selectedPackageId
                }
              >
                {importActivities.isPending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Importing...
                  </>
                ) : (
                  <>
                    <FileUp className="mr-2 h-4 w-4" />
                    Import Activities
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 