const { get } = require('http');
const fetch = require('node-fetch');
require('dotenv').config();

const apiToken = process.env.CALCOM_API_KEY;

async function getAvailableSlots() {
    const now = new Date();
    const startTime = now.toISOString();
    const end = new Date(now);
    end.setDate(now.getDate() + 7);
    const endTime = end.toISOString();

    const eventTypeId = 1409993;
    const eventTypeSlug = 'ai-voice-agent-discovery';
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
            // Convert slot times to Australia/Sydney time
            const slotsInSydneyTime = [];
            for (const date in data.data.slots) {
                data.data.slots[date].forEach(slot => {
                    const utcDate = new Date(slot.time);
                    const sydneyTime = utcDate.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' });
                    slotsInSydneyTime.push({ date, time: sydneyTime });
                });
            }
            return slotsInSydneyTime; // Array of formatted slots
        } else {
            throw new Error('Failed to retrieve slots');
        }
    } catch (error) {
        console.error('Error fetching slots:', error);
        throw error;
    }
}

module.exports = { getAvailableSlots };