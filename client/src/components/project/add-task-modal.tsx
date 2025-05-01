import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { WbsItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { addDays } from "date-fns";
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
  name: string;
  description?: string;
  startDate?: string | null;
  endDate?: string | null;
  duration?: number;
  percentComplete?: number;
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
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  duration: z.number().optional().nullable(),
  percentComplete: z.number().min(0).max(100).default(0),
}).refine(data => {
  // Either endDate or duration must be provided
  return !!data.endDate || !!data.duration;
}, {
  message: "Either End Date or Duration must be provided",
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
      startDate: "",
      endDate: "",
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
      // If endDate is not provided but duration is, calculate the end date
      let endDate = values.endDate;
      
      if (!endDate && values.startDate && values.duration) {
        const startDate = new Date(values.startDate);
        const calculatedEndDate = addDays(startDate, values.duration);
        endDate = calculatedEndDate.toISOString().split('T')[0];
      }
      
      // Create task object
      const task: Task = {
        activityId: parseInt(values.activityId),
        name: values.name,
        description: values.description,
        startDate: values.startDate || null,
        endDate: endDate || null,
        duration: values.duration || undefined,
        percentComplete: values.percentComplete,
      };
      
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
        description: "Failed to add task. Please try again.",
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
                      value={field.value}
                      onChange={field.onChange}
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
                      value={field.value}
                      onChange={field.onChange}
                      disabled={!!form.watch("duration")}
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
                        disabled={!!form.watch("endDate")}
                        placeholder="Duration in days"
                        {...field}
                        value={field.value === null ? '' : field.value}
                        onChange={e => {
                          const value = e.target.value === '' ? null : parseInt(e.target.value);
                          field.onChange(value);
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