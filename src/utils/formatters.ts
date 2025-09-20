/**
 * Format volume numbers in Indian notation
 * @param volume The volume number to format
 * @returns Formatted string with Cr (Crores) or L (Lakhs) suffix
 */
export const formatVolume = (volume: number): string => {
  if (volume >= 1_00_00_000) {
    return `${(volume / 1_00_00_000).toFixed(2)}Cr`;
  } else if (volume >= 1_00_000) {
    return `${(volume / 1_00_000).toFixed(2)}L`;
  } else if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K`;
  } else {
    return volume.toString();
  }
};

/**
 * Format currency in Indian Rupees
 * @param amount The amount to format
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Format percentage with proper sign and color indication
 * @param percentage The percentage to format
 * @returns Formatted percentage string
 */
export const formatPercentage = (percentage: number): string => {
  const sign = percentage >= 0 ? '+' : '';
  return `${sign}${percentage.toFixed(2)}%`;
};