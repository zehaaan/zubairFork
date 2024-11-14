const express = require('express');
const { getAvailableSlots } = require('./availability');
const app = express();
const PORT = 80;

// Import the `luxon` library to handle timezone-specific conversions
const { DateTime } = require('luxon');

let morningSlots = [];
let middaySlots = [];
let afternoonSlots = [];
let currentSuggestionIndex = 0;

app.use(express.json());

// Helper function to parse date string manually to ISO format
function parseToISO(dateString) {
    try {
        const [datePart, timePart] = dateString.split(', ');
        const [day, month, year] = datePart.split('/');
        const [time, period] = timePart.split(' ');
        const [hours, minutes] = time.split(':').map(Number);

        // Adjust hour based on AM/PM
        let hour = hours;
        if (period.toLowerCase() === 'pm' && hour !== 12) {
            hour += 12;
        } else if (period.toLowerCase() === 'am' && hour === 12) {
            hour = 0;
        }

        // Return formatted date string in ISO
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    } catch (error) {
        console.error(`Error parsing date: ${dateString}`, error);
        return null;
    }
}

// Helper function to format date and time conversationally
function formatToConversationalDate(dateString) {
    try {
        const date = new Date(dateString);
        const options = { weekday: 'long', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: 'Australia/Sydney' };
        return date.toLocaleString('en-AU', options);
    } catch (error) {
        console.error(`Error formatting date: ${dateString}`, error);
        return "Invalid Date";
    }
}

// Helper to parse and categorize slots by time of day
function categorizeSlotsByTime(slots) {
    slots.forEach(slot => {
        const isoTime = parseToISO(slot.time);
        if (!isoTime) return;

        const slotTime = new Date(isoTime);
        const hour = slotTime.getHours();

        if (hour >= 6 && hour < 12) {
            morningSlots.push(slot);
        } else if (hour >= 12 && hour < 17) {
            middaySlots.push(slot);
        } else if (hour >= 17 && hour < 22) {
            afternoonSlots.push(slot);
        }
    });

    console.log(`Morning slots: ${morningSlots.length}`);
    console.log(`Midday slots: ${middaySlots.length}`);
    console.log(`Afternoon slots: ${afternoonSlots.length}`);
}

// Initialize and categorize slots at server startup
(async function initializeSlots() {
    try {
        const allAvailableSlots = await getAvailableSlots();
        console.log('Fetched available slots:', allAvailableSlots);
        categorizeSlotsByTime(allAvailableSlots);
        console.log('Slots categorized by time of day.');
    } catch (error) {
        console.error('Failed to initialize slots:', error);
    }
})();

// Helper to get varied time suggestions
function getVariedTimeSuggestions() {
    const suggestions = [];

    if (morningSlots[currentSuggestionIndex]) {
        suggestions.push({
            ...morningSlots[currentSuggestionIndex],
            formattedTime: formatToConversationalDate(parseToISO(morningSlots[currentSuggestionIndex].time))
        });
    }
    if (middaySlots[currentSuggestionIndex]) {
        suggestions.push({
            ...middaySlots[currentSuggestionIndex],
            formattedTime: formatToConversationalDate(parseToISO(middaySlots[currentSuggestionIndex].time))
        });
    }
    if (afternoonSlots[currentSuggestionIndex]) {
        suggestions.push({
            ...afternoonSlots[currentSuggestionIndex],
            formattedTime: formatToConversationalDate(parseToISO(afternoonSlots[currentSuggestionIndex].time))
        });
    }

    return suggestions;
}

// Route to suggest 3 varied time slots
app.get('/get-available-slots', (req, res) => {
    const slotsToSuggest = getVariedTimeSuggestions();

    if (slotsToSuggest.length > 0) {
        currentSuggestionIndex += 1;
        res.json({ status: 'success', slots: slotsToSuggest });
    } else {
        res.json({ status: 'error', message: 'No more available slots.' });
    }
});

// Route to reset slot suggestions if needed
app.get('/reset-slots', (req, res) => {
    currentSuggestionIndex = 0;
    res.json({ status: 'success', message: 'Slot suggestions have been reset.' });
});

// Helper function to parse conversational date in Australia/Sydney and convert to ISO 8601 in UTC
function parseConversationalDate(conversationalDate) {
    try {
        const now = DateTime.now().setZone('Australia/Sydney');
        let targetDate = now;
        let dayOfWeek = null;
        let timeString = null;
        let nextWeek = false;

        // Split the conversational date into words for flexible parsing
        const words = conversationalDate.toLowerCase().split(' ');

        // Interpret keywords like "tomorrow," "next," and specific weekdays
        if (words.includes('tomorrow')) {
            targetDate = now.plus({ days: 1 });
            timeString = words.slice(words.indexOf('at') + 1).join(' ');
        } else if (words[0] === 'next') {
            nextWeek = true;
            dayOfWeek = words[1];
            timeString = words.slice(3).join(' ');
        } else {
            // Parse day of the week and time for phrases like "Friday at 9am"
            dayOfWeek = words[0];
            timeString = words.slice(2).join(' ');
        }

        // Adjust target date for day of the week if specified
        if (dayOfWeek) {
            // Start from tomorrow to ensure future dates
            targetDate = targetDate.plus({ days: 1 });
            while (targetDate.weekdayLong.toLowerCase() !== dayOfWeek) {
                targetDate = targetDate.plus({ days: 1 });
            }
            // Add 7 days if "next" week was specified
            if (nextWeek) targetDate = targetDate.plus({ days: 7 });
        }

        // Extract hours and minutes from time string using regex
        const timeMatch = timeString.match(/(\d+):?(\d{0,2})?\s?(am|pm)?/i);
        if (!timeMatch) throw new Error("Invalid time format");

        let [_, hour, minute, period] = timeMatch;
        hour = parseInt(hour, 10);
        minute = parseInt(minute || '0', 10);

        // Adjust hour based on AM/PM
        if (period && period.toLowerCase() === 'pm' && hour !== 12) {
            hour += 12;
        } else if (period && period.toLowerCase() === 'am' && hour === 12) {
            hour = 0;
        }

        // Combine target date and time
        targetDate = targetDate.set({ hour, minute, second: 0 });

        // Convert to UTC in ISO format
        return targetDate.toUTC().toISO();
    } catch (error) {
        console.error(`Error parsing conversational date: ${conversationalDate}`, error);
        return null;
    }
}

// New endpoint to convert conversational date to ISO 8601 in UTC
app.post('/convert-date', (req, res) => {
    const { conversationalDate } = req.body;
    if (!conversationalDate) {
        return res.status(400).json({ status: 'error', message: 'Conversational date is required.' });
    }

    const isoDate = parseConversationalDate(conversationalDate);
    if (!isoDate) {
        return res.status(400).json({ status: 'error', message: 'Invalid conversational date format.' });
    }

    res.json({ status: 'success', isoDate });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});