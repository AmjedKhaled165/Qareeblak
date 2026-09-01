/**
 * Mock API for Development Testing
 * Remove this and use real API when backend is ready
 */

export const mockBookingsApi = {
    async create(data: any) {
        return {
            id: Math.random().toString(36).substr(2, 9),
            ...data,
            status: 'pending',
            date: new Date().toISOString(),
            halanStatus: 'pending'
        };
    },

    async getById(id: string) {
        // Return mock order data
        return {
            id,
            status: 'confirmed',
            halanStatus: 'assigned',
            providerName: 'مطعم العائلة',
            userName: 'محمد أحمد',
            serviceName: 'توصيل طعام',
            price: 150,
            date: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
            details: 'العنوان: شارع النيل، الدور الثاني',
            source: 'halan',
            isQareeblak: false,
            items: [
                {
                    id: '1',
                    name: 'فراخ مشوية',
                    quantity: 2,
                    price: 60,
                    description: 'فراخ مشوية بالثوم والليمون'
                },
                {
                    id: '2',
                    name: 'أرز مبهرج',
                    quantity: 2,
                    price: 30,
                    description: 'أرز مصري'
                }
            ]
        };
    },

    async update(id: string, data: any) {
        return {
            id,
            ...data,
            updatedAt: new Date().toISOString()
        };
    },

    async getByProvider(providerId: string) {
        return [
            {
                id: '1',
                status: 'pending',
                providerName: 'مطعم الأمير',
                date: new Date().toISOString(),
                items: []
            },
            {
                id: '2',
                status: 'confirmed',
                providerName: 'مطعم الأمير',
                date: new Date().toISOString(),
                items: []
            }
        ];
    },

    async getByUser(userId: string) {
        return [
            {
                id: '3',
                status: 'confirmed',
                halanStatus: 'assigned',
                providerName: 'مطعم العائلة',
                date: new Date(Date.now() - 3600000).toISOString(),
                items: [
                    { id: '1', name: 'فراخ مشوية', quantity: 1, price: 60 },
                    { id: '2', name: 'أرز', quantity: 1, price: 30 }
                ]
            },
            {
                id: '4',
                status: 'completed',
                halanStatus: 'delivered',
                providerName: 'بيتزا هاوس',
                date: new Date(Date.now() - 86400000).toISOString(),
                items: [
                    { id: '1', name: 'بيتزا دجاج', quantity: 1, price: 85 }
                ]
            },
            {
                id: '5',
                status: 'cancelled',
                halanStatus: 'cancelled',
                providerName: 'كنتاكي',
                date: new Date(Date.now() - 172800000).toISOString(),
                items: []
            }
        ];
    },

    async getAll() {
        return [
            {
                id: '3',
                status: 'confirmed',
                halanStatus: 'assigned',
                providerName: 'مطعم العائلة',
                date: new Date().toISOString(),
                items: []
            }
        ];
    },

    async updateStatus(id: string, status: string) {
        return {
            id,
            status,
            updatedAt: new Date().toISOString()
        };
    }
};
