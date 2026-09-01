import React, { useState, useEffect } from 'react';

interface BirthDatePickerProps {
  value: string; // 'YYYY-MM-DD'
  onChange: (value: string) => void;
  required?: boolean;
  theme?: 'dark' | 'light';
  className?: string;
}

export const BirthDatePicker: React.FC<BirthDatePickerProps> = ({
  value,
  onChange,
  required = true,
  theme = 'dark',
  className = '',
}) => {
  // Parse initial YYYY-MM-DD
  const parseDate = (val: string) => {
    if (!val) return { year: '1995', month: '05', day: '15' };
    const parts = val.split('-');
    if (parts.length === 3) {
      return {
        year: parts[0] || '1995',
        month: parts[1].padStart(2, '0') || '01',
        day: parts[2].padStart(2, '0') || '01',
      };
    }
    return { year: '1995', month: '05', day: '15' };
  };

  const initial = parseDate(value);
  const [year, setYear] = useState<string>(initial.year);
  const [month, setMonth] = useState<string>(initial.month);
  const [day, setDay] = useState<string>(initial.day);

  // Sync state when external value changes
  useEffect(() => {
    const parsed = parseDate(value);
    setYear(parsed.year);
    setMonth(parsed.month);
    setDay(parsed.day);
  }, [value]);

  // Calculate days in selected month and year
  const getDaysInMonth = (y: number, m: number) => {
    return new Date(y, m, 0).getDate();
  };

  const handleYearChange = (newYear: string) => {
    setYear(newYear);
    const maxDays = getDaysInMonth(parseInt(newYear, 10) || 1995, parseInt(month, 10) || 1);
    let validDay = day;
    if (parseInt(day, 10) > maxDays) {
      validDay = String(maxDays).padStart(2, '0');
      setDay(validDay);
    }
    onChange(`${newYear}-${month.padStart(2, '0')}-${validDay.padStart(2, '0')}`);
  };

  const handleMonthChange = (newMonth: string) => {
    const paddedMonth = newMonth.padStart(2, '0');
    setMonth(paddedMonth);
    const maxDays = getDaysInMonth(parseInt(year, 10) || 1995, parseInt(paddedMonth, 10) || 1);
    let validDay = day;
    if (parseInt(day, 10) > maxDays) {
      validDay = String(maxDays).padStart(2, '0');
      setDay(validDay);
    }
    onChange(`${year}-${paddedMonth}-${validDay.padStart(2, '0')}`);
  };

  const handleDayChange = (newDay: string) => {
    const paddedDay = newDay.padStart(2, '0');
    setDay(paddedDay);
    onChange(`${year}-${month.padStart(2, '0')}-${paddedDay}`);
  };

  // Generate Year options (e.g. 1950 to current year - 19)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 70 }, (_, i) => currentYear - 19 - i); // 20세 이상 대상
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const daysInCurrentSelection = getDaysInMonth(parseInt(year, 10) || 1995, parseInt(month, 10) || 1);
  const days = Array.from({ length: daysInCurrentSelection }, (_, i) => String(i + 1).padStart(2, '0'));

  const isDark = theme === 'dark';

  const selectClasses = isDark
    ? 'bg-stone-950 border border-stone-800 text-stone-100 text-xs rounded-xl px-2 py-2 focus:outline-none focus:border-rose-500 cursor-pointer appearance-none text-center font-medium'
    : 'bg-stone-50 border border-stone-200 text-stone-900 text-xs sm:text-sm rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer appearance-none text-center font-medium';

  return (
    <div className={`grid grid-cols-3 gap-1.5 ${className}`}>
      {/* Year */}
      <div className="relative">
        <select
          value={year}
          onChange={(e) => handleYearChange(e.target.value)}
          required={required}
          className={`w-full ${selectClasses}`}
        >
          {years.map((y) => (
            <option key={y} value={String(y)} className={isDark ? 'bg-stone-900 text-stone-100' : 'bg-white text-stone-900'}>
              {y}년
            </option>
          ))}
        </select>
      </div>

      {/* Month */}
      <div className="relative">
        <select
          value={month}
          onChange={(e) => handleMonthChange(e.target.value)}
          required={required}
          className={`w-full ${selectClasses}`}
        >
          {months.map((m) => (
            <option key={m} value={m} className={isDark ? 'bg-stone-900 text-stone-100' : 'bg-white text-stone-900'}>
              {parseInt(m, 10)}월
            </option>
          ))}
        </select>
      </div>

      {/* Day */}
      <div className="relative">
        <select
          value={day}
          onChange={(e) => handleDayChange(e.target.value)}
          required={required}
          className={`w-full ${selectClasses}`}
        >
          {days.map((d) => (
            <option key={d} value={d} className={isDark ? 'bg-stone-900 text-stone-100' : 'bg-white text-stone-900'}>
              {parseInt(d, 10)}일
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
