-- Data migration: rename event category "Corporate Worship" to "Community Worship"
UPDATE "Event" SET category = 'Community Worship' WHERE category = 'Corporate Worship';
UPDATE "Event" SET category = 'Community Worship' WHERE category = 'Corporate Worship (Weekly Recurring)';
