/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import {
  Calendar,
  CalendarDate,
  endOfMonth,
  getDayOfWeek,
  GregorianCalendar,
  isSameDay,
  isSameMonth,
  startOfMonth,
  toCalendar,
  toCalendarDate,
  today
} from '@internationalized/date';
import {CalendarProps, DateValue} from '@react-types/calendar';
import {CalendarState} from './types';
import {useControlledState} from '@react-stately/utils';
import {useDateFormatter} from '@react-aria/i18n';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useWeekStart} from './useWeekStart';

interface CalendarStateOptions<T extends DateValue> extends CalendarProps<T> {
  createCalendar: (name: string) => Calendar
}

export function useCalendarState<T extends DateValue>(props: CalendarStateOptions<T>): CalendarState {
  let defaultFormatter = useDateFormatter();
  let resolvedOptions = useMemo(() => defaultFormatter.resolvedOptions(), [defaultFormatter]);
  let {
    createCalendar,
    timeZone = resolvedOptions.timeZone
  } = props;

  let calendar = useMemo(() => createCalendar(resolvedOptions.calendar), [createCalendar, resolvedOptions.calendar]);

  let [value, setControlledValue] = useControlledState<DateValue>(props.value, props.defaultValue, props.onChange);
  let calendarDateValue = useMemo(() => value ? toCalendar(toCalendarDate(value), calendar) : null, [value, calendar]);
  let defaultMonth = calendarDateValue || toCalendar(today(timeZone), calendar);
  let [currentMonth, setCurrentMonth] = useState(defaultMonth); // TODO: does this need to be in state at all??
  let [focusedDate, setFocusedDate] = useState(defaultMonth);
  let [isFocused, setFocused] = useState(props.autoFocus || false);
  let weekStart = useWeekStart();
  let monthStartsAt = (getDayOfWeek(startOfMonth(currentMonth)) - weekStart) % 7;
  if (monthStartsAt < 0) {
    monthStartsAt += 7;
  }

  // Reset focused date and current month when calendar changes.
  let lastCalendarIdentifier = useRef(calendar.identifier);
  useEffect(() => {
    if (calendar.identifier !== lastCalendarIdentifier.current) {
      let newFocusedDate = toCalendar(focusedDate, calendar);
      setCurrentMonth(startOfMonth(newFocusedDate));
      setFocusedDate(newFocusedDate);
      lastCalendarIdentifier.current = calendar.identifier;
    }
  }, [calendar, focusedDate]);

  let days = currentMonth.calendar.getDaysInMonth(currentMonth);
  let weeksInMonth = Math.ceil((monthStartsAt + days) / 7);
  let minDate = props.minValue;
  let maxDate = props.maxValue;

  // Sets focus to a specific cell date
  function focusCell(date: CalendarDate) {
    if (isInvalid(date, minDate, maxDate)) {
      return;
    }

    if (!isSameMonth(date, currentMonth)) {
      setCurrentMonth(startOfMonth(date));
      setFocusedDate(date);
      return;
    }

    setFocusedDate(date);
  }

  function setValue(newValue: CalendarDate) {
    if (!props.isDisabled && !props.isReadOnly) {
      // The display calendar should not have any effect on the emitted value.
      // Emit dates in the same calendar as the original value, if any, otherwise gregorian.
      newValue = toCalendar(newValue, value?.calendar || new GregorianCalendar());

      // Preserve time if the input value had one.
      if (value && 'hour' in value) {
        setControlledValue(value.set(newValue));
      } else {
        setControlledValue(newValue);
      }
    }
  }

  let weekDays = useMemo(() => (
    [...new Array(7).keys()]
      .map(index => startOfMonth(currentMonth).add({days: index - monthStartsAt}))
  ), [currentMonth, monthStartsAt]);

  return {
    isDisabled: props.isDisabled,
    isReadOnly: props.isReadOnly,
    value: calendarDateValue,
    setValue,
    currentMonth,
    focusedDate,
    timeZone,
    setFocusedDate,
    focusNextDay() {
      focusCell(focusedDate.add({days: 1}));
    },
    focusPreviousDay() {
      focusCell(focusedDate.subtract({days: 1}));
    },
    focusNextWeek() {
      focusCell(focusedDate.add({weeks: 1}));
    },
    focusPreviousWeek() {
      focusCell(focusedDate.subtract({weeks: 1}));
    },
    focusNextMonth() {
      focusCell(focusedDate.add({months: 1}));
    },
    focusPreviousMonth() {
      focusCell(focusedDate.subtract({months: 1}));
    },
    focusStartOfMonth() {
      focusCell(startOfMonth(focusedDate));
    },
    focusEndOfMonth() {
      focusCell(endOfMonth(focusedDate));
    },
    focusNextYear() {
      focusCell(focusedDate.add({years: 1}));
    },
    focusPreviousYear() {
      focusCell(focusedDate.subtract({years: 1}));
    },
    selectFocusedDate() {
      setValue(focusedDate);
    },
    selectDate(date) {
      setValue(date);
    },
    isFocused,
    setFocused,
    weeksInMonth,
    weekStart,
    daysInMonth: currentMonth.calendar.getDaysInMonth(currentMonth),
    weekDays,
    getCellDate(weekIndex, dayIndex) {
      let days = (weekIndex * 7 + dayIndex) - monthStartsAt;
      return startOfMonth(currentMonth).add({days});
    },
    isInvalid(date) {
      return isInvalid(date, minDate, maxDate);
    },
    isSelected(date) {
      return calendarDateValue != null && isSameDay(date, calendarDateValue);
    },
    isCellFocused(date) {
      return isFocused && focusedDate && isSameDay(date, focusedDate);
    },
    isCellDisabled(date) {
      return props.isDisabled || !isSameMonth(date, currentMonth) || isInvalid(date, minDate, maxDate);
    },
    isPreviousMonthInvalid() {
      return isInvalid(endOfMonth(currentMonth.subtract({months: 1})), minDate, maxDate);
    },
    isNextMonthInvalid() {
      return isInvalid(startOfMonth(currentMonth.add({months: 1})), minDate, maxDate);
    }
  };
}

function isInvalid(date: CalendarDate, minDate: DateValue, maxDate: DateValue) {
  return (minDate != null && date.compare(minDate) < 0) ||
    (maxDate != null && date.compare(maxDate) > 0);
}
