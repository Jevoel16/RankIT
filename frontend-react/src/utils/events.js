export const SPORTS_CATEGORY = 'Sports Events Category';
export const EVENT_CATEGORIES = ['Special Events Category', 'Literary Events Category', SPORTS_CATEGORY];

export const isSportsEvent = (event) => event?.category === SPORTS_CATEGORY || event?.scoringMode === 'sets';

// Sports events are scored per set; each set is out of 25 and weighted equally.
export const buildSetCriteria = (setCount) => {
  const count = Math.max(1, Number(setCount) || 1);
  return Array.from({ length: count }, (_, index) => ({
    label: `Set ${index + 1}`,
    description: `Set ${index + 1}`,
    maxScore: 25,
    weight: Number((100 / count).toFixed(2))
  }));
};

const STATUS_LABELS = { live: 'In progress', finalized: 'Ended', scheduled: 'Scheduled' };
export const eventStatusLabel = (status) => STATUS_LABELS[status] || 'Scheduled';
