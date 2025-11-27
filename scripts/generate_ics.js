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

    if (dateStr.toLowerCase().includes("not announced yet")) {
        return { startDate: null, endDate: null };
    }

    const monthMap = {
        "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
        "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12
    };

    const yearMatch = dateStr.match(/\b(\d{4})\b/);
    if (yearMatch) {
        year = parseInt(yearMatch[1]);
        dateStr = dateStr.replace(`, ${year}`, "");
    }

    if (dateStr.includes(" - ") || dateStr.includes(" to ")) {
        const separator = dateStr.includes(" - ") ? " - " : " to ";
        const parts = dateStr.split(separator);

        if (parts.length === 2) {
            const startPart = parts[0].trim();
            const endPart = parts[1].trim();

            let startMonth = null;
            let endMonth = null;

            for (const month of Object.keys(monthMap)) {
                if (startPart.toLowerCase().includes(month)) startMonth = month;
                if (endPart.toLowerCase().includes(month)) endMonth = month;
            }

            if (!startMonth) {
                for (const month of Object.keys(monthMap)) {
                    if (dateStr.toLowerCase().includes(month)) {
                        startMonth = month;
                        break;
                    }
                }
            }

            if (!endMonth) endMonth = startMonth;

            const startDayMatch = startPart.match(/(\d+)/);
            const endDayMatch = endPart.match(/(\d+)/);

            if (startDayMatch && endDayMatch && startMonth && endMonth) {
                const startDate = new Date(year, monthMap[startMonth] - 1, parseInt(startDayMatch[0]));
                const endDate = new Date(year, monthMap[endMonth] - 1, parseInt(endDayMatch[0]));

                if (endDate < startDate && monthMap[endMonth] < monthMap[startMonth]) {
                    endDate.setFullYear(year + 1);
                }

                const startISO = startDate.toISOString().split('T')[0];
                endDate.setDate(endDate.getDate() + 1);
                const endISO = endDate.toISOString().split('T')[0];

                return { startDate: startISO, endDate: endISO };
            }
        }
    } else {
        let month = null;
        for (const m of Object.keys(monthMap)) {
            if (dateStr.toLowerCase().includes(m)) {
                month = m;
                break;
            }
        }

        const dayMatch = dateStr.match(/(\d+)/);

        if (dayMatch && month) {
            const date = new Date(year, monthMap[month] - 1, parseInt(dayMatch[0]));
            const startISO = date.toISOString().split('T')[0];
            date.setDate(date.getDate() + 1);
            const endISO = date.toISOString().split('T')[0];

            return { startDate: startISO, endDate: endISO };
        }
    }

    return { startDate: null, endDate: null };
}

/**
 * Generates an ICS file from event data.
 */
function generateICS(events) {
    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Open Source Events//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
    ];

    events.forEach(event => {
        if (event.startDate && event.endDate) {
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

    icsContent.push('END:VCALENDAR');
    return icsContent.join('\r\n');
}

/**
 * Extracts events from markdown and generates calendar files.
 */
async function main() {
    try {
        const currentYear = new Date().getFullYear();
        const markdownText = await fetchContent(README_URL);

        // ---- YEAR DETECTION LOGIC ----
        let detectedYear = null;

        // Strategy 1: Detect year from README heading
        const headerYearMatch = markdownText.match(/open source events.*?(20\d{2})/i);
        if (headerYearMatch) {
            detectedYear = parseInt(headerYearMatch[1], 10);
            console.log(`Detected event year from heading: ${detectedYear}`);
        } else {
            // Strategy 2: detect first 20xx in entire doc
            const yearMatch = markdownText.match(/\b20\d{2}\b/);
            if (yearMatch) {
                detectedYear = parseInt(yearMatch[0], 10);
                console.log(`Detected event year from content: ${detectedYear}`);
            } else {
                // Last resort
                detectedYear = currentYear;
                console.log(`No year detected; defaulting to current year: ${detectedYear}`);
            }
        }

        // ---- EVENT EXTRACTION ----
        const eventPattern = /- \[(.*?)\]\((.*?)\)\n\s*> Date: (.*?) \|\| Mode: (.*?) \|\| Location: (.*?)\./g;

        const events = [];
        let eventMatch;
        let successCount = 0;
        let failCount = 0;

        while ((eventMatch = eventPattern.exec(markdownText)) !== null) {
            const [_, name, url, date, mode, location] = eventMatch;

            const { startDate, endDate } = parseDate(date, detectedYear);

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
            console.error("No events were successfully parsed. Check date formats.");
            return;
        }

        events.sort((a, b) => a.startDate.localeCompare(b.startDate));

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

        const icsContent = generateICS(events);
        fs.writeFileSync("events.ics", icsContent, 'utf8');

        console.log(`Successfully parsed ${successCount} events (${failCount} skipped)`);
        console.log("JSON and ICS files generated successfully!");

    } catch (error) {
        console.error(`Error occurred: ${error.message}`);
    }
}

main();
