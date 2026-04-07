const initialTasks = [
    {
        id: 1,
        title: "Morning Jog at Cubbon Park",
        location: "outdoor",
        priority: "medium",
        timeSlot: "morning",
        note: "Preferred start 7:30 AM."
    },
    {
        id: 2,
        title: "Grocery Shopping",
        location: "outdoor",
        priority: "high",
        timeSlot: "afternoon",
        note: "Need to buy fresh vegetables from the local market."
    },
    {
        id: 3,
        title: "Product Design Sync",
        location: "indoor",
        priority: "high",
        timeSlot: "morning",
        note: "Zoom meeting with the design team."
    },
    {
        id: 4,
        title: "Evening Gym Session",
        location: "indoor",
        priority: "low",
        timeSlot: "evening",
        note: "Standard workout routine."
    },
    {
        id: 5,
        title: "Visit Hardware Store",
        location: "outdoor",
        priority: "medium",
        timeSlot: "evening",
        note: "Need supplies for home repair."
    }
];

const historicalNotes = [
    "Traffic heavy near MTH Road during evening rains.",
    "Local market closes 30 mins early if it's raining heavily.",
    "Electricity outages common in Sector 4 during thunderstorms.",
    "Delivery apps frequently surge prices during rain.",
    "Underpass near 5th cross floods quickly.",
    "Work from home is highly recommended during orange alerts."
];

// Exporting to global scope as we're not using modules for simplicity in this vanilla JS demo
window.initialTasks = initialTasks;
window.historicalNotes = historicalNotes;
