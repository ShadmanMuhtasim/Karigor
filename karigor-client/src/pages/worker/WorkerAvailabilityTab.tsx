import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workerApi } from '../../api/workerApi';
import type { SetAvailabilitySlotDto } from '../../api/workerApi';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

interface DaySchedule {
  dayOfWeek: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export function WorkerAvailabilityTab() {
  const queryClient = useQueryClient();
  const [schedule, setSchedule] = useState<DaySchedule[]>(
    DAYS_OF_WEEK.map((_, i) => ({ dayOfWeek: i, enabled: false, startTime: '09:00', endTime: '17:00' }))
  );
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: availability, isLoading } = useQuery({
    queryKey: ['workerAvailability'],
    queryFn: workerApi.getAvailability,
  });

  useEffect(() => {
    if (availability) {
      setSchedule(prev => prev.map(day => {
        const existing = availability.find(a => a.dayOfWeek === day.dayOfWeek);
        if (existing) {
          return {
            ...day,
            enabled: true,
            startTime: existing.startTime,
            endTime: existing.endTime
          };
        }
        return { ...day, enabled: false };
      }));
    }
  }, [availability]);

  const mutation = useMutation({
    mutationFn: workerApi.updateAvailability,
    onSuccess: () => {
      setSaveMessage({ type: 'success', text: 'Schedule updated successfully!' });
      queryClient.invalidateQueries({ queryKey: ['workerAvailability'] });
      queryClient.invalidateQueries({ queryKey: ['workerStats'] });
      setTimeout(() => setSaveMessage(null), 3000);
    },
    onError: (error: any) => {
      setSaveMessage({ type: 'error', text: error.response?.data?.error || 'Failed to update schedule.' });
    }
  });

  const handleToggle = (dayOfWeek: number) => {
    setSchedule(prev => prev.map(d => d.dayOfWeek === dayOfWeek ? { ...d, enabled: !d.enabled } : d));
  };

  const handleTimeChange = (dayOfWeek: number, field: 'startTime' | 'endTime', value: string) => {
    setSchedule(prev => prev.map(d => d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage(null);
    
    // Validate StartTime < EndTime client-side
    for (const day of schedule.filter(d => d.enabled)) {
      if (day.startTime >= day.endTime) {
        setSaveMessage({ type: 'error', text: `Invalid time range for ${DAYS_OF_WEEK[day.dayOfWeek]}: Start time must be before end time.` });
        return;
      }
    }

    const payload: SetAvailabilitySlotDto[] = schedule
      .filter(d => d.enabled)
      .map(d => ({
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime
      }));

    mutation.mutate(payload);
  };

  if (isLoading) return <div className="text-gray-400">Loading availability...</div>;

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-emerald-400">Weekly Availability</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="space-y-3">
            {schedule.map((day) => (
              <div key={day.dayOfWeek} className="flex items-center gap-4 bg-gray-800/50 p-3 rounded-lg border border-gray-800">
                <div className="w-32 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`day-${day.dayOfWeek}`}
                    checked={day.enabled}
                    onChange={() => handleToggle(day.dayOfWeek)}
                    className="w-4 h-4 rounded border-gray-600 text-emerald-500 focus:ring-emerald-500 bg-gray-700"
                  />
                  <label htmlFor={`day-${day.dayOfWeek}`} className={`text-sm font-medium ${day.enabled ? 'text-gray-200' : 'text-gray-500'}`}>
                    {DAYS_OF_WEEK[day.dayOfWeek]}
                  </label>
                </div>
                
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={day.startTime}
                    onChange={(e) => handleTimeChange(day.dayOfWeek, 'startTime', e.target.value)}
                    disabled={!day.enabled}
                    className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed focus:border-emerald-500 focus:outline-none"
                    required={day.enabled}
                  />
                  <span className="text-gray-500 text-sm">to</span>
                  <input
                    type="time"
                    value={day.endTime}
                    onChange={(e) => handleTimeChange(day.dayOfWeek, 'endTime', e.target.value)}
                    disabled={!day.enabled}
                    className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed focus:border-emerald-500 focus:outline-none"
                    required={day.enabled}
                  />
                </div>
              </div>
            ))}
          </div>

          {saveMessage && (
            <div className={`p-3 rounded-md text-sm ${saveMessage.type === 'success' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
              {saveMessage.text}
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
