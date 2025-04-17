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
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  disabledDates?: (date: Date) => boolean
  onBlur?: () => void
}

export function DatePicker({
  date,
  setDate,
  className,
  placeholder = "Select date",
  disabled = false,
  disabledDates,
  onBlur,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [dateInput, setDateInput] = React.useState<string>(date ? format(date, "yyyy-MM-dd") : "")

  // Update the input field when date prop changes
  React.useEffect(() => {
    if (date) {
      setDateInput(format(date, "yyyy-MM-dd"))
    } else {
      setDateInput("")
    }
  }, [date])

  // Handle direct input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setDateInput(value)
    
    if (value) {
      const inputDate = new Date(value)
      if (!isNaN(inputDate.getTime())) {
        setDate(inputDate)
      }
    } else {
      setDate(undefined)
    }
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
            onSelect={(date) => {
              setDate(date)
              setOpen(false)
            }}
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
