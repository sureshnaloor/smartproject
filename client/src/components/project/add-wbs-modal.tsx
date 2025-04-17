import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { extendedInsertWbsItemSchema, InsertWbsItem, WbsItem } from "@shared/schema";
import { calculateDuration, isValidDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";

interface AddWbsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  parentId?: number | null;
  onSuccess?: () => void;
}

export function AddWbsModal({ isOpen, onClose, projectId, parentId = null, onSuccess }: AddWbsModalProps) {
  const [showDuration, setShowDuration] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch WBS items for the project to use as parent options and predecessors
  const { data: wbsItems = [] } = useQuery<WbsItem[]>({
    queryKey: [`/api/projects/${projectId}/wbs`],
    enabled: isOpen,
  });

  // Get potential parent WBS item
  const parentItem = parentId ? wbsItems.find(item => item.id === parentId) : null;
  
  // Calculate the next code
  const calculateNextCode = () => {
    if (!parentId) {
      const topLevelItems = wbsItems.filter(item => !item.parentId);
      return `${topLevelItems.length + 1}`;
    }
    
    const siblings = wbsItems.filter(item => item.parentId === parentId);
    const parentCode = parentItem?.code || "";
    return `${parentCode}.${siblings.length + 1}`;
  };

  // Calculate the level based on parent
  const calculateLevel = () => {
    if (!parentId) return 1;
    return (parentItem?.level || 0) + 1;
  };

  // Form definition
  const form = useForm<InsertWbsItem>({
    resolver: zodResolver(extendedInsertWbsItemSchema),
    defaultValues: {
      projectId,
      parentId,
      name: "",
      description: "",
      level: calculateLevel(),
      code: calculateNextCode(),
      type: "Activity",
      budgetedCost: 0,
      startDate: new Date(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 7)),
      duration: 7,
      isTopLevel: false,
    },
  });

  // Get form values
  const { startDate, endDate, duration } = form.watch();

  // Update dates and duration when one changes
  const updateDatesAndDuration = (field: 'startDate' | 'endDate' | 'duration', value: any) => {
    if (field === 'startDate' && endDate) {
      const newDuration = calculateDuration(value, new Date(endDate));
      form.setValue('duration', newDuration);
      form.setValue(field, value);
    } 
    else if (field === 'endDate' && startDate) {
      const newDuration = calculateDuration(new Date(startDate), value);
      form.setValue('duration', newDuration);
      form.setValue(field, value);
    }
    else if (field === 'duration' && startDate) {
      const newEndDate = new Date(startDate);
      newEndDate.setDate(newEndDate.getDate() + Number(value) - 1);
      form.setValue('endDate', newEndDate);
      form.setValue(field, Number(value));
    }
  };

  // Create WBS item mutation
  const createWbsItem = useMutation({
    mutationFn: async (data: InsertWbsItem) => {
      const response = await apiRequest("POST", "/api/wbs", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/wbs`] });
      toast({
        title: "WBS Item Created",
        description: "The WBS item has been created successfully.",
        variant: "default",
      });
      form.reset();
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create WBS item. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: InsertWbsItem) => {
    createWbsItem.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New WBS Item</DialogTitle>
          <DialogDescription>
            Create a new work breakdown structure item for your project.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent WBS</FormLabel>
                  <Select
                    value={field.value?.toString() || ""}
                    onValueChange={(value) => {
                      const newParentId = value === "" ? null : parseInt(value);
                      field.onChange(newParentId);
                      
                      // Update level and code when parent changes
                      const parent = newParentId ? wbsItems.find(item => item.id === newParentId) : null;
                      const newLevel = parent ? parent.level + 1 : 1;
                      form.setValue("level", newLevel);
                      
                      // Calculate new code
                      const siblings = wbsItems.filter(item => item.parentId === newParentId);
                      const newCode = parent 
                        ? `${parent.code}.${siblings.length + 1}`
                        : `${wbsItems.filter(item => !item.parentId).length + 1}`;
                      form.setValue("code", newCode);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a parent WBS item" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Parent (Top Level)</SelectItem>
                      {wbsItems
                        .filter(item => item.type === "Summary")
                        .map((item) => (
                          <SelectItem key={item.id} value={item.id.toString()}>
                            {item.code} - {item.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the parent WBS item. Leave empty for top-level items.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WBS Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter WBS name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WBS Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Summary">Summary</SelectItem>
                        <SelectItem value="Activity">Activity</SelectItem>
                        <SelectItem value="Task">Task</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WBS Code</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly />
                    </FormControl>
                    <FormDescription>
                      Automatically generated code
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="budgetedCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budgeted Cost ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <DatePicker
                        date={field.value ? new Date(field.value) : undefined}
                        setDate={(date) => {
                          if (date) {
                            updateDatesAndDuration('startDate', date);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showDuration ? (
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Duration (days)
                        <Button
                          type="button"
                          variant="link"
                          className="ml-2 p-0 h-auto text-xs"
                          onClick={() => setShowDuration(false)}
                        >
                          Switch to End Date
                        </Button>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="1"
                          {...field}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            if (!isNaN(value) && value > 0) {
                              updateDatesAndDuration('duration', value);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        End Date
                        <Button
                          type="button"
                          variant="link"
                          className="ml-2 p-0 h-auto text-xs"
                          onClick={() => setShowDuration(true)}
                        >
                          Switch to Duration
                        </Button>
                      </FormLabel>
                      <FormControl>
                        <DatePicker
                          date={field.value ? new Date(field.value) : undefined}
                          setDate={(date) => {
                            if (date) {
                              updateDatesAndDuration('endDate', date);
                            }
                          }}
                          disabledDates={(date) => {
                            return startDate && date < new Date(startDate);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WBS Level</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly />
                    </FormControl>
                    <FormDescription>
                      Automatically determined
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional description"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createWbsItem.isPending}
              >
                {createWbsItem.isPending && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Add WBS Item
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
