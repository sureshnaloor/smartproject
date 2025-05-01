import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"

interface DatePickerProps {
  value?: Date | string | null | undefined
  onChange?: (date: Date | null) => void
  selected?: Date | null
  onSelect?: (date: Date | null) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  disabledDates?: (date: Date) => boolean
  onBlur?: () => void
}

export function DatePicker({
  value,
  onChange,
  selected,
  onSelect,
  className,
  placeholder = "Select date",
  disabled = false,
  disabledDates,
  onBlur,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  
  // Support both value/onChange and selected/onSelect APIs
  const actualValue = selected ?? value;
  const handleChange = onSelect ?? onChange;
  
  // Convert string or Date to Date object for internal use
  const getDateValue = (): Date | null | undefined => {
    if (actualValue === null || actualValue === undefined) return actualValue;
    if (actualValue instanceof Date) return actualValue;
    const date = new Date(actualValue);
    return !isNaN(date.getTime()) ? date : undefined;
  }
  
  const date = getDateValue();
  
  const [dateInput, setDateInput] = React.useState<string>(
    date ? format(date, "yyyy-MM-dd") : ""
  )

  // Update the input field when date prop changes
  React.useEffect(() => {
    if (date) {
      setDateInput(format(date, "yyyy-MM-dd"))
    } else {
      setDateInput("")
    }
  }, [actualValue])

  // Handle direct input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDateInput(inputValue);
    
    if (inputValue && handleChange) {
      const inputDate = new Date(inputValue);
      if (!isNaN(inputDate.getTime())) {
        handleChange(inputDate);
      }
    } else if (handleChange) {
      handleChange(null);
    }
  }

  // Handle calendar selection
  const handleCalendarSelect = (date: Date | undefined) => {
    if (date && handleChange) {
      handleChange(date);
    } else if (handleChange) {
      handleChange(null);
    }
    setOpen(false);
  }

  // Handle input blur
  const handleBlur = () => {
    if (dateInput && !date) {
      // If input is invalid, reset it
      setDateInput(date ? format(date, "yyyy-MM-dd") : "")
    }
    
    if (onBlur) {
      onBlur()
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "MMMM d, yyyy") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date ?? undefined}
            onSelect={handleCalendarSelect}
            disabled={disabledDates || disabled}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <Input
        type="date"
        value={dateInput}
        onChange={handleInputChange}
        onBlur={handleBlur}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
      />
    </div>
  )
}

