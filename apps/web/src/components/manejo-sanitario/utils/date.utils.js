export const formatDuration = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const calculateAgeInDays = (sowingDate) => {
  if (!sowingDate) return 0;
  const sowing = new Date(sowingDate);
  const today = new Date();
  const diffTime = today - sowing;
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
};
