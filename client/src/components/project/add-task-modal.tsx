import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { WbsItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { addDays, format } from "date-fns";
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
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Define Task interface
interface Task {
  id?: number;
  activityId: number;
  projectId?: number;
  name: string;
  description?: string;
  startDate?: string | null;
  endDate?: string | null;
  duration?: number;
  percentComplete?: number;
  dependencies?: { predecessorId: number; successorId: number; type: string; lag: number }[];
}

// Define props for the AddTaskModal component
interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (task: Task) => void;
  activities: WbsItem[];
  selectedActivityId?: number | null;
}

// Create schema for form validation
const taskFormSchema = z.object({
  activityId: z.string().refine(val => !!val, "Activity is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  startDate: z.date().nullable().optional(),
  endDate: z.date().nullable().optional(),
  duration: z.number().nonnegative("Duration must be a positive number").nullable().optional(),
  percentComplete: z.number().min(0).max(100, "Progress must be between 0 and 100").default(0).optional(),
}).refine(data => {
  console.log("Refining form data:", data);
  
  // If no start date is provided, no validation needed for end date/duration
  if (!data.startDate) return true;
  
  // If start date exists, either end date or duration should be provided
  return (data.endDate !== null && data.endDate !== undefined) || 
         (data.duration !== null && data.duration !== undefined);
}, {
  message: "When start date is provided, please provide either end date or duration",
  path: ["endDate"],
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

// The AddTaskModal component
export function AddTaskModal({ 
  isOpen, 
  onClose, 
  onAdd, 
  activities,
  selectedActivityId 
}: AddTaskModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  // Initialize form with react-hook-form and zod validation
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      activityId: selectedActivityId ? String(selectedActivityId) : "",
      name: "",
      description: "",
      startDate: null,
      endDate: null,
      duration: null,
      percentComplete: 0,
    },
  });
  
  // Update form when selectedActivityId changes
  useEffect(() => {
    if (selectedActivityId) {
      form.setValue("activityId", String(selectedActivityId));
    }
  }, [selectedActivityId, form]);
  
  // Handle form submission
  const onSubmit = async (values: TaskFormValues) => {
    setIsLoading(true);
    
    try {
      // Calculate endDate if not provided but duration is, and startDate exists
      let endDate: Date | null = values.endDate ?? null;
      let duration = values.duration;
      
      // Format dates as ISO strings for the API
      const startDateString = values.startDate ? values.startDate.toISOString() : null;
      let endDateString = null;
      
      // Only calculate/include either endDate or duration, not both
      if (values.endDate) {
        // If end date is explicitly provided, use it and don't include duration
        endDateString = values.endDate.toISOString();
        duration = undefined; // Don't include duration if we have end date
      } else if (values.startDate && values.duration) {
        // If we have start date and duration, calculate end date
        const calculatedEndDate = addDays(values.startDate, values.duration);
        endDateString = calculatedEndDate.toISOString();
        // Keep duration in this case
      }
      
      // Get project ID from selected activity
      const selectedActivity = activities.find(a => a.id === parseInt(values.activityId));
      const projectId = selectedActivity?.projectId;
      
      if (!projectId) {
        throw new Error("Could not determine project ID from selected activity");
      }
      
      // Create task object with required fields
      const task: Task = {
        activityId: parseInt(values.activityId),
        projectId: projectId,
        name: values.name,
        description: values.description || "",
        percentComplete: values.percentComplete || 0
      };
      
      // Only add startDate if it exists
      if (startDateString) {
        task.startDate = startDateString;
      }
      
      // Only add one of endDate or duration, not both
      if (endDateString) {
        task.endDate = endDateString;
      } else if (duration) {
        task.duration = duration;
      }
      
      console.log("Submitting task:", task);
      
      // Call the onAdd callback
      onAdd(task);
      
      // Reset form and close modal
      form.reset();
      onClose();
      
      // Show success toast
      toast({
        title: "Task Added",
        description: "The task has been added successfully.",
        variant: "default",
      });
    } catch (error) {
      console.error("Error adding task:", error);
      
      // Show error toast
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle modal close - reset form
  const handleClose = () => {
    form.reset();
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>
            Create a new task for an activity. Tasks are the smallest unit of work.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="activityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Activity</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    disabled={selectedActivityId !== null}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Activity" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activities.filter(item => item.type === "Activity").map((activity) => (
                        <SelectItem key={activity.id} value={String(activity.id)}>
                          {activity.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter task name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter task description" 
                      {...field} 
                      value={field.value || ""}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <DatePicker
                      selected={field.value}
                      onSelect={(date) => {
                        field.onChange(date);
                        
                        // If duration is set, auto-calculate end date
                        const duration = form.getValues('duration');
                        if (date && duration) {
                          const calculatedEndDate = addDays(date, duration);
                          form.setValue('endDate', calculatedEndDate);
                        }
                      }}
                      disabled={isLoading}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <DatePicker
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={!!form.watch("duration") || isLoading}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (days)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0}
                        disabled={!!form.watch("endDate") || isLoading}
                        placeholder="Duration in days"
                        {...field}
                        value={field.value === null ? '' : field.value}
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : Number(e.target.value);
                          field.onChange(value);
                          
                          // Calculate end date if start date is provided
                          const startDate = form.getValues('startDate');
                          if (startDate && value !== null) {
                            const calculatedEndDate = addDays(startDate, value);
                            form.setValue('endDate', null); // Clear end date to avoid conflicts
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="percentComplete"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Progress (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0} 
                        max={100}
                        placeholder="0"
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Adding..." : "Add Task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 