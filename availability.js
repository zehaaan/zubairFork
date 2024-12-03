const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();

const apiToken = process.env.CALCOM_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

async function getAvailableSlots() {
    const now = new Date();
    const startTime = now.toISOString();
    const end = new Date(now);
    end.setDate(now.getDate() + 7);
    const endTime = end.toISOString();

    const eventTypeId = 1408517;
    const eventTypeSlug = 'callbackevent';
    const duration = 30;
    const url = `https://api.cal.com/v2/slots/available?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&eventTypeId=${eventTypeId}&eventTypeSlug=${eventTypeSlug}&duration=${duration}`;

    const options = {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
        },
    };

    try {
        const response = await fetch(url, options);
        const data = await response.json();

        if (data.status === 'success') {
            // Convert slot times to Los Angeles time
            const slotsInLosAngelesTime = [];
            for (const date in data.data.slots) {
                data.data.slots[date].forEach(slot => {
                    const utcDate = new Date(slot.time);
                    const losAngelesTime = utcDate.toLocaleString('en-US', { timeZone: 'America/Toronto' });
                    slotsInLosAngelesTime.push({ date, time: losAngelesTime });
                });
            }
            return slotsInLosAngelesTime; // Array of formatted slots
        } else {
            throw new Error('Failed to retrieve slots');
        }
    } catch (error) {
        console.error('Error fetching slots:', error);
        throw error;
    }
}

// Define a route to fetch available slots
app.get('/available-slots', async (req, res) => {
    try {
        const slots = await getAvailableSlots();
        res.json(slots);  // Send the available slots as JSON response
    } catch (error) {
        res.status(500).json({ error: 'Error fetching available slots' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
