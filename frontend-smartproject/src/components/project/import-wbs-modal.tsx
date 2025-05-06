import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { WbsItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { parseCsvFile, downloadCsvTemplate } from "@/lib/csv";

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

interface ImportWbsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
}

// Form schema
const formSchema = z.object({
  csvFile: z.instanceof(FileList).refine(
    (files) => files.length === 1,
    "Please select a CSV file"
  ),
});

type FormValues = z.infer<typeof formSchema>;

export function ImportWbsModal({ isOpen, onClose, projectId }: ImportWbsModalProps) {
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

  // Import WBS items mutation
  const importWbsItems = useMutation({
    mutationFn: async (data: any[]) => {
      try {
        const response = await apiRequest("POST", "/api/wbs/import", {
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
        description: `${csvData.length} WBS items have been imported.`,
        variant: "default",
      });
      handleClose();
    },
    onError: (error: any) => {
      console.error("Import error details:", error);
      
      let errorMessage = "Failed to import WBS items. Please check your CSV file.";
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
    
    importWbsItems.mutate(csvData);
  };

  // Handle modal close
  const handleClose = () => {
    form.reset();
    setCsvData([]);
    setParseErrors([]);
    setIsParsingComplete(false);
    onClose();
  };

  // Download CSV template
  const handleDownloadTemplate = () => {
    downloadCsvTemplate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import WBS Items</DialogTitle>
          <DialogDescription>
            Upload a CSV file with WBS items. Download the template to see the required format.
          </DialogDescription>
        </DialogHeader>

        <Alert className="mb-4">
          <AlertDescription>
            <p className="mb-1 font-semibold">Import Requirements:</p>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li><strong>Required fields:</strong> wbsCode, wbsName, wbsType</li>
              <li><strong>WBS Type rules:</strong></li>
              <ul className="list-disc pl-5 text-xs space-y-1 mt-1">
                <li><strong>Summary/WorkPackage:</strong> Must have budget amount, cannot have dates</li>
                <li><strong>Activity:</strong> Must have dates (start/end or duration), cannot have budget</li>
              </ul>
              <li>Existing WBS items with matching codes will be updated</li>
              <li>Date format must be YYYY-MM-DD</li>
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
                      Upload a CSV file with the required columns: wbsCode, wbsName, wbsType, and other properties
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                variant="outline"
                className="mt-8"
                onClick={handleDownloadTemplate}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>

            <Alert className="mb-4 border-yellow-300 bg-yellow-50">
              <AlertDescription className="flex">
                <AlertTriangle className="h-5 w-5 mr-2 text-amber-600 flex-shrink-0" />
                <p className="text-sm">
                  <strong>Important:</strong> The template includes example WBS items with different types. 
                  Make sure to follow the validation rules for each type.
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
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.map((row, index) => {
                        // Check if this code already exists
                        const existingItem = wbsItems.find(item => item.code === row.wbsCode);
                        
                        return (
                          <TableRow key={index}>
                            <TableCell>
                              {row.wbsCode}
                              {existingItem && (
                                <Badge variant="outline" className="ml-2 text-xs">Exists</Badge>
                              )}
                            </TableCell>
                            <TableCell>{row.wbsName}</TableCell>
                            <TableCell>{row.wbsType}</TableCell>
                            <TableCell className="text-right font-mono">
                              {row.amount ? `$${parseFloat(row.amount).toFixed(2)}` : '-'}
                            </TableCell>
                            <TableCell>{row.startDate || '-'}</TableCell>
                            <TableCell>{row.endDate || '-'}</TableCell>
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
                disabled={importWbsItems.isPending || csvData.length === 0 || parseErrors.length > 0}
              >
                {importWbsItems.isPending ? (
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
                    Import WBS Items
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
