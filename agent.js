/**
 * ScheduleAgent - Intelligent scheduling logic for monsoon disruptions.
 */
class ScheduleAgent {
    constructor(tasks, historicalNotes, sensitivity = 'medium') {
        this.tasks = tasks;
        this.historicalNotes = historicalNotes;
        this.sensitivity = sensitivity;
    }

    /**
     * Reschedules tasks based on weather conditions and user sensitivity.
     * @param {boolean} isRainy - Current weather status.
     * @returns {Object} { rescheduledTasks, explanation, suggestions, stats }
     */
    processSchedule(isRainy) {
        const rescheduledTasks = JSON.parse(JSON.stringify(this.tasks));
        const explanation = [];
        const suggestions = [];
        let tasksAdjustedCount = 0;
        let timeSaved = 0;

        // Sensitivity thresholds
        const shouldRescheduleOutdoor = isRainy && this.sensitivity !== 'low';
        const shouldRescheduleAll = isRainy && this.sensitivity === 'high';

        if (isRainy) {
            rescheduledTasks.forEach(task => {
                const isOutdoor = task.location === 'outdoor';
                const isUrgent = task.priority === 'high' || task.category === 'Urgent';
                
                // Logic for rescheduling based on location and sensitivity
                let needsAdjustment = false;
                if (this.sensitivity === 'high' && isRainy) needsAdjustment = true;
                if (this.sensitivity === 'medium' && isOutdoor) needsAdjustment = true;
                if (this.sensitivity === 'low' && isOutdoor && !isUrgent) needsAdjustment = true;

                if (needsAdjustment) {
                    const originalTime = task.timeSlot;
                    
                    if (task.timeSlot === 'morning') {
                        task.timeSlot = 'evening';
                        task.statusNote = `Moved to Evening: Rain expected in morning.`;
                        explanation.push(`Morning rain alert. Moved "${task.title}" to 6 PM.`);
                        tasksAdjustedCount++;
                        timeSaved += 30;
                    } else if (task.timeSlot === 'afternoon') {
                        task.timeSlot = 'morning';
                        task.statusNote = `Rescheduled to Morning: Avoid afternoon storm.`;
                        explanation.push(`Storm predicted for 2 PM. Moved "${task.title}" to 9 AM.`);
                        tasksAdjustedCount++;
                        timeSaved += 45;
                    } else if (task.timeSlot === 'evening') {
                        task.timeSlot = 'morning';
                        task.statusNote = `Moved to Morning: Heavy evening rain traffic.`;
                        explanation.push(`Traffic surge expected. Moved "${task.title}" early to 10 AM.`);
                        tasksAdjustedCount++;
                        timeSaved += 60;
                    }
                }
            });

            if (this.sensitivity === 'high') {
                suggestions.push("High Sensitivity active: All outdoor tasks have been restricted.");
            }
            suggestions.push("Traffic alert: MTH Road is flooded. Use the Ring Road route.");
            suggestions.push("Heavy downpour expected: Consider ordered groceries via Blinkit instead of store visit.");
        } else {
            explanation.push("Everything looks good! No weather disruptions detected in the forecast.");
            suggestions.push("Clear skies! A great time for any outdoor tasks you had pending.");
        }

        return {
            tasks: rescheduledTasks,
            explanation: explanation,
            suggestions: suggestions,
            stats: {
                tasksAdjusted: tasksAdjustedCount,
                timeSaved: timeSaved
            }
        };
    }

    findContext(taskTitle) {
        return this.historicalNotes.filter(note => 
            taskTitle.toLowerCase().split(' ').some(word => note.toLowerCase().includes(word))
        );
    }
}

// Export to global scope
window.ScheduleAgent = ScheduleAgent;
