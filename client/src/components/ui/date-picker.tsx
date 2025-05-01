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
  value?: string | Date | undefined
  onChange: (date: string) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  disabledDates?: (date: Date) => boolean
  onBlur?: () => void
}

export function DatePicker({
  value,
  onChange,
  className,
  placeholder = "Select date",
  disabled = false,
  disabledDates,
  onBlur,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  
  // Convert string or Date to Date object for internal use
  const getDateValue = (): Date | undefined => {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    const date = new Date(value);
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
  }, [value])

  // Handle direct input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDateInput(inputValue);
    
    if (inputValue) {
      const inputDate = new Date(inputValue);
      if (!isNaN(inputDate.getTime())) {
        onChange(inputValue);
      }
    } else {
      onChange("");
    }
  }

  // Handle calendar selection
  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      const formattedDate = format(date, "yyyy-MM-dd");
      onChange(formattedDate);
    } else {
      onChange("");
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
            selected={date}
            onSelect={handleCalendarSelect}
            disabled={disabledDates}
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
      />
    </div>
  )
}

