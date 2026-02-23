/**
 * Category Detection Utilities
 * Helper functions to identify provider types based on category
 */

// Keywords that identify pharmacy/medical providers
const PHARMACY_KEYWORDS = [
    'طبي',
    'صيدلي',
    'صيدلية',
    'صيدليات',
    'طب',
    'دواء',
    'أدوية',
    'medical',
    'pharmacy',
    'pharmacies',
    'medicine',
    'خدمات طبية',
];

/**
 * Check if a provider is a pharmacy/medical provider
 * @param category - The provider's category string
 * @returns true if the provider is a pharmacy/medical provider
 */
export function isPharmacyProvider(category: string | undefined | null): boolean {
    if (!category) return false;

    const normalized = category.toLowerCase().trim();
    return PHARMACY_KEYWORDS.some(keyword =>
        normalized.includes(keyword.toLowerCase())
    );
}

/**
 * Get the display label for a pharmacy provider
 * @param category - The provider's category string
 * @returns Appropriate label for the provider type
 */
export function getPharmacyLabel(category: string): string {
    if (category.includes('صيدلي') || category.includes('pharmacy')) {
        return 'صيدلية';
    }
    return 'خدمات طبية';
}

// Keywords for restaurant/food providers
const RESTAURANT_KEYWORDS = [
    'مطعم',
    'مطاعم',
    'restaurant',
    'food',
    'طعام',
    'بقالة',
    'grocery',
];

/**
 * Check if a provider is a restaurant/food provider
 * @param category - The provider's category string
 * @returns true if the provider is a restaurant
 */
export function isRestaurantProvider(category: string | undefined | null): boolean {
    if (!category) return false;

    const normalized = category.toLowerCase().trim();
    return RESTAURANT_KEYWORDS.some(keyword =>
        normalized.includes(keyword.toLowerCase())
    );
}

// Keywords for maintenance/plumbing/electrical providers
const MAINTENANCE_KEYWORDS = [
    'صيانة',
    'سباكة',
    'كهرباء',
    'كهربائي',
    'نجارة',
    'دهانات',
    'تكييف',
    'maintenance',
    'plumbing',
    'electrical',
];

/**
 * Check if a provider is a maintenance/service provider
 * @param category - The provider's category string
 * @returns true if the provider is a maintenance provider
 */
export function isMaintenanceProvider(category: string | undefined | null): boolean {
    if (!category) return false;

    const normalized = category.toLowerCase().trim();
    return MAINTENANCE_KEYWORDS.some(keyword =>
        normalized.includes(keyword.toLowerCase())
    );
}
