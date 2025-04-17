import { z } from "zod";
import { csvImportSchema, CsvImportData } from "@shared/schema";

export async function parseCsvFile(file: File): Promise<{ data: any[]; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== "string") {
        return reject(new Error("Failed to read file as text"));
      }
      
      try {
        const { data, errors } = parseCsvText(text);
        resolve({ data, errors });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Error reading file"));
    };
    
    reader.readAsText(file);
  });
}

export function parseCsvText(text: string): { data: any[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
  const headers = lines[0].split(",").map(header => header.trim());
  
  // Check if required columns exist
  const requiredColumns = ["wbsCode", "amount", "entryDate"];
  const missingColumns = requiredColumns.filter(col => !headers.includes(col));
  
  if (missingColumns.length > 0) {
    return {
      data: [],
      errors: [`Missing required columns: ${missingColumns.join(", ")}`]
    };
  }
  
  const data = [];
  const errors = [];
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(",").map(value => value.trim());
    
    // Skip if number of values doesn't match headers
    if (values.length !== headers.length) {
      errors.push(`Line ${i + 1}: Column count mismatch (expected ${headers.length}, got ${values.length})`);
      continue;
    }
    
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    
    data.push(row);
  }
  
  // Validate the parsed data against the schema
  try {
    csvImportSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        const path = err.path.join(".");
        errors.push(`${path}: ${err.message}`);
      });
    }
  }
  
  return { data, errors };
}

export function generateCsvTemplate(): string {
  return "wbsCode,amount,description,entryDate\n1.1,1000,Foundation work,2023-07-15\n2.1,1500,Electrical equipment,2023-07-16";
}

export function downloadCsvTemplate(): void {
  const csvContent = generateCsvTemplate();
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "cost_import_template.csv");
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function validateCsvData(data: any[]): CsvImportData {
  return csvImportSchema.parse(data);
}
