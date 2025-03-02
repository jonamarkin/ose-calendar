const fs = require('fs');
const https = require('https');

// URL of the README file
const README_URL = "https://raw.githubusercontent.com/Everything-Open-Source/open-source-events/main/README.md";

/**
 * Fetches content from a URL.
 * @param {string} url - The URL to fetch from.
 * @returns {Promise<string>} - The response text.
 */
function fetchContent(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to fetch from ${url}: ${response.statusCode}`));
                return;
            }

            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                resolve(data);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Parses a date string and returns start and end dates.
 * @param {string} dateStr - The date string to parse.
 * @param {number} year - The year to use (if not specified in the date).
 * @returns {Object} - An object with startDate and endDate properties.
 */
function parseDate(dateStr, year = new Date().getFullYear()) {
    // Remove suffixes like "th", "st", etc.
    dateStr = dateStr.replace(/(\d+)(st|nd|rd|th)/g, "$1");

    // Skip "not announced yet" dates
    if (dateStr.toLowerCase().includes("not announced yet")) {
        return { startDate: null, endDate: null };
    }

    // Define month name to number mapping
    const monthMap = {
        "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
        "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12
    };

    // Check if year is explicitly mentioned
    const yearMatch = dateStr.match(/\b(\d{4})\b/);
    if (yearMatch) {
        year = parseInt(yearMatch[1]);
        // Remove the year from the date string to simplify parsing
        dateStr = dateStr.replace(`, ${year}`, "");
    }

    // Handle date ranges (e.g., "18 - 19 January")
    if (dateStr.includes(" - ") || dateStr.includes(" to ")) {
        const separator = dateStr.includes(" - ") ? " - " : " to ";
        const parts = dateStr.split(separator);

        if (parts.length === 2) {
            const startPart = parts[0].trim();
            const endPart = parts[1].trim();

            // Extract month names
            let startMonth = null;
            let endMonth = null;

            // Find month in date parts
            for (const month of Object.keys(monthMap)) {
                if (startPart.toLowerCase().includes(month)) {
                    startMonth = month;
                }
                if (endPart.toLowerCase().includes(month)) {
                    endMonth = month;
                }
            }

            // If month not found in specific parts, check the whole string
            if (!startMonth) {
                for (const month of Object.keys(monthMap)) {
                    if (dateStr.toLowerCase().includes(month)) {
                        startMonth = month;
                        break;
                    }
                }
            }

            // If end month not specified, use start month
            if (!endMonth) {
                endMonth = startMonth;
            }

            // Extract day numbers
            const startDayMatch = startPart.match(/(\d+)/);
            const endDayMatch = endPart.match(/(\d+)/);

            if (startDayMatch && endDayMatch && startMonth && endMonth) {
                const startDay = parseInt(startDayMatch[0]);
                const endDay = parseInt(endDayMatch[0]);

                // Create date objects
                const startDate = new Date(year, monthMap[startMonth] - 1, startDay);
                const endDate = new Date(year, monthMap[endMonth] - 1, endDay);

                // If end date is before start date, it might be in the next year
                if (endDate < startDate && monthMap[endMonth] < monthMap[startMonth]) {
                    endDate.setFullYear(year + 1);
                }

                // Format dates as ISO strings (YYYY-MM-DD)
                const startISO = startDate.toISOString().split('T')[0];

                // Add a day to end date to make it exclusive (calendar convention)
                endDate.setDate(endDate.getDate() + 1);
                const endISO = endDate.toISOString().split('T')[0];

                return { startDate: startISO, endDate: endISO };
            }
        }
    } else {
        // Handle single dates (e.g., "4 March")
        let month = null;

        // Find month in the date string
        for (const m of Object.keys(monthMap)) {
            if (dateStr.toLowerCase().includes(m)) {
                month = m;
                break;
            }
        }

        // Extract day number
        const dayMatch = dateStr.match(/(\d+)/);

        if (dayMatch && month) {
            const day = parseInt(dayMatch[0]);

            // Create date object
            const date = new Date(year, monthMap[month] - 1, day);

            // Format date as ISO string (YYYY-MM-DD)
            const startISO = date.toISOString().split('T')[0];

            // Add a day for end date (exclusive)
            date.setDate(date.getDate() + 1);
            const endISO = date.toISOString().split('T')[0];

            return { startDate: startISO, endDate: endISO };
        }
    }

    return { startDate: null, endDate: null };
}

/**
 * Generates an ICS file from event data.
 * @param {Array} events - Array of event objects.
 * @returns {string} - ICS file content.
 */
function generateICS(events) {
    // ICS file header
    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Open Source Events//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
    ];

    // Add each event
    events.forEach(event => {
        if (event.startDate && event.endDate) {
            // Format dates for ICS (remove hyphens and add 'T000000Z' for time)
            const startFormatted = event.startDate.replace(/-/g, '') + 'T000000Z';
            const endFormatted = event.endDate.replace(/-/g, '') + 'T000000Z';

            icsContent = icsContent.concat([
                'BEGIN:VEVENT',
                `UID:${Math.random().toString(36).substring(2, 15)}@opensourceevents.com`,
                `DTSTAMP:${new Date().toISOString().replace(/[-:.]/g, '').split('T')[0]}T000000Z`,
                `DTSTART:${startFormatted}`,
                `DTEND:${endFormatted}`,
                `SUMMARY:${event.name}`,
                `DESCRIPTION:Mode: ${event.mode}\\nLocation: ${event.location}\\nURL: ${event.url}`,
                `URL:${event.url}`,
                `LOCATION:${event.location}`,
                'END:VEVENT'
            ]);
        }
    });

    // Add footer
    icsContent.push('END:VCALENDAR');

    // Join with line breaks
    return icsContent.join('\r\n');
}

/**
 * Extracts events from markdown content and generates calendar files.
 */
async function main() {
    try {
        // Get the current year
        const currentYear = new Date().getFullYear();

        // Fetch README content
        const markdownText = await fetchContent(README_URL);

        // Regular expression to extract events
        const eventPattern = /- \[(.*?)\]\((.*?)\)\n\s*> Date: (.*?) \|\| Mode: (.*?) \|\| Location: (.*?)\./g;

        // Extract events
        const events = [];
        let eventMatch;
        let successCount = 0;
        let failCount = 0;

        while ((eventMatch = eventPattern.exec(markdownText)) !== null) {
            const [_, name, url, date, mode, location] = eventMatch;

            // Parse the date
            const { startDate, endDate } = parseDate(date, currentYear);

            if (startDate && endDate) {
                events.push({
                    name,
                    url,
                    start_date: startDate,
                    end_date: endDate,
                    startDate,
                    endDate,
                    mode,
                    location,
                    original_date: date
                });
                successCount++;
            } else {
                console.warn(`Unable to parse date '${date}' for event '${name}'. Skipping...`);
                failCount++;
            }
        }

        if (events.length === 0) {
            console.error("No events were successfully parsed. Check the date formats and errors above.");
            return;
        }

        // Sort events by start date
        events.sort((a, b) => a.startDate.localeCompare(b.startDate));

        // Save JSON file
        fs.writeFileSync(
            "events.json",
            JSON.stringify(events.map(e => ({
                name: e.name,
                url: e.url,
                start_date: e.start_date,
                end_date: e.end_date,
                mode: e.mode,
                location: e.location,
                original_date: e.original_date
            })), null, 2),
            'utf8'
        );

        // Generate and save ICS file
        const icsContent = generateICS(events);
        fs.writeFileSync("events.ics", icsContent, 'utf8');

        console.log(`Successfully parsed ${successCount} events (${failCount} skipped)`);
        console.log("JSON and ICS files generated successfully!");

    } catch (error) {
        console.error(`Error occurred: ${error.message}`);
    }
}

// Run the script
main();