import { useState } from "react";
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
    "wbsCode,name,description,startDate,endDate,duration,percentComplete",
    "1.1.1,Activity 1,Example activity,2024-01-01,2024-01-10,10,50",
    "1.1.2,Activity 2,Another example,2024-01-15,2024-01-20,6,25",
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

export function ImportActivityModal({ isOpen, onClose, projectId, workPackageId }: ImportActivityModalProps) {
  const [csvData, setCsvData] = useState<any[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isParsingComplete, setIsParsingComplete] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch WBS items for reference
  const { data: wbsItems = [] } = useQuery<WbsItem[]>({
    queryKey: [`/api/projects/${projectId}/wbs`],
    enabled: isOpen,
  });

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
      
      const { data, errors } = await parseCsvFile(file);
      
      setCsvData(data);
      setParseErrors(errors);
      setIsParsingComplete(true);
      
      if (errors.length > 0) {
        toast({
          title: "CSV Validation Errors",
          description: `${errors.length} errors found in the CSV file.`,
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
      try {
        const response = await apiRequest("POST", "/api/wbs/activities/import", {
          projectId,
          csvData: data,
        });
        return response.json();
      } catch (error) {
        console.error("CSV import error:", error);
        throw error;
      }
    },
    onSuccess: () => {
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
      
      let errorMessage = "Failed to import activities. Please check your CSV file.";
      let errorDetails: string[] = [];
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      if (error.errors && Array.isArray(error.errors)) {
        errorMessage = `${error.errors.length} validation errors found. Please check your CSV file.`;
        errorDetails = error.errors;
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
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Activities</DialogTitle>
          <DialogDescription>
            Upload a CSV file with activities. Download the template to see the required format.
          </DialogDescription>
        </DialogHeader>

        <Alert className="mb-4">
          <AlertDescription>
            <p className="mb-1 font-semibold">Import Requirements:</p>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li><strong>Required fields:</strong> wbsCode (must match an existing Activity)</li>
              <li><strong>Optional fields:</strong> name, description, startDate, endDate, duration, percentComplete</li>
              <li>Date format must be YYYY-MM-DD</li>
              <li>Existing activities with matching WBS codes will be updated</li>
              {workPackageId && (
                <li className="text-blue-600">Only importing activities for the selected Work Package</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>

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
                      Upload a CSV file to update existing activity details
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
                  <strong>Important:</strong> This tool updates existing activities only.
                  The WBS code must match an existing activity in the project.
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.map((row, index) => {
                        // Find the matching activity
                        const existingItem = wbsItems.find(item => 
                          item.code === row.wbsCode && 
                          item.type === "Activity" &&
                          (!workPackageId || (workPackageId && item.parentId === workPackageId))
                        );
                        
                        return (
                          <TableRow key={index} className={!existingItem ? "bg-red-50" : undefined}>
                            <TableCell>
                              {row.wbsCode}
                              {existingItem ? (
                                <Badge variant="outline" className="ml-2 text-xs">Exists</Badge>
                              ) : (
                                <Badge variant="destructive" className="ml-2 text-xs">Not Found</Badge>
                              )}
                            </TableCell>
                            <TableCell>{row.name || (existingItem ? existingItem.name : '-')}</TableCell>
                            <TableCell>{row.startDate || (existingItem ? existingItem.startDate?.toString().slice(0, 10) : '-')}</TableCell>
                            <TableCell>{row.endDate || (existingItem ? existingItem.endDate?.toString().slice(0, 10) : '-')}</TableCell>
                            <TableCell>{row.duration || (existingItem ? existingItem.duration : '-')}</TableCell>
                            <TableCell>{row.percentComplete || (existingItem ? existingItem.percentComplete : '-')}</TableCell>
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
                disabled={importActivities.isPending || csvData.length === 0 || parseErrors.length > 0}
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
                    Update Activities
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