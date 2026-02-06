/**
 * BACKEND IMPLEMENTATION EXAMPLES
 * For Qareeblak Order Management System
 * 
 * These are example implementations for Node.js/Express + Database
 * Adapt these to your specific backend framework and database
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. DATABASE SCHEMA - SQL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Add 'source' column to orders table
 * Run these migrations to update your database
 */

-- Migration: add_source_column_to_orders
ALTER TABLE orders ADD COLUMN source VARCHAR(50) DEFAULT 'manual' NOT NULL;

-- Add index for better query performance
CREATE INDEX idx_orders_source ON orders(source);
CREATE INDEX idx_orders_source_status ON orders(source, status);
CREATE INDEX idx_orders_source_created ON orders(source, created_at);

-- Verify column
-- DESCRIBE orders; -- or SHOW COLUMNS FROM orders; (MySQL)
-- \d orders; -- (PostgreSQL)


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. TYPE DEFINITIONS - TypeScript
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

enum OrderSource {
  QAREEBLAK = 'qareeblak',
  MANUAL = 'manual',
  WHATSAPP = 'whatsapp',
  API = 'api',
  IMPORT = 'import'
}

interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  pickup_address?: string;
  
  // ← NEW FIELD
  source: OrderSource;
  
  status: 'pending' | 'assigned' | 'ready_for_pickup' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  
  // Qareeblak orders: supervisor_id should be NULL
  supervisor_id?: number | null;
  supervisor_name?: string;
  
  courier_id?: number;
  courier_name?: string;
  
  delivery_fee: number;
  total_price: number;
  items?: OrderItem[];
  
  created_at: Date;
  delivered_at?: Date;
  notes?: string;
}

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface DashboardStats {
  summary: {
    total_delivery_fees: number;
    total_sales: number;
    delivered: number;
    total_orders: number;
    qareeblak_delivery_revenue: number;
    qareeblak_orders_count: number;
  };
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. ORDERS REPOSITORY/SERVICE - Node.js + Knex.js Example
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class OrderService {
  constructor(private db: any) {}

  /**
   * Get orders with filtering support
   * 
   * Query Parameters:
   * - source: 'qareeblak' | 'manual' | 'whatsapp' | 'api' | 'import'
   * - status: 'pending' | 'delivered' | 'cancelled' | etc.
   * - supervisorId: number
   * - courierId: number
   * - search: string (searches in name, phone, address)
   */
  async getOrders(filters: {
    source?: string;
    status?: string;
    supervisorId?: number;
    courierId?: number;
    search?: string;
  }) {
    let query = this.db('orders');

    // Filter by source (new functionality)
    if (filters.source && filters.source !== 'all') {
      query = query.where('source', '=', filters.source);
    }

    // Filter by status
    if (filters.status && filters.status !== 'all') {
      query = query.where('status', '=', filters.status);
    }

    // Filter by supervisor
    if (filters.supervisorId && filters.supervisorId !== 'all') {
      query = query.where('supervisor_id', '=', filters.supervisorId);
    }

    // Filter by courier
    if (filters.courierId && filters.courierId !== 'all') {
      query = query.where('courier_id', '=', filters.courierId);
    }

    // Search functionality
    if (filters.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      query = query.where((builder: any) => {
        builder
          .where('customer_name', 'like', searchTerm)
          .orWhere('customer_phone', 'like', searchTerm)
          .orWhere('delivery_address', 'like', searchTerm)
          .orWhere('pickup_address', 'like', searchTerm)
          .orWhere('notes', 'like', searchTerm);
      });
    }

    // Sort by creation date (newest first)
    query = query.orderBy('created_at', 'desc');

    return await query;
  }

  /**
   * Create a new order
   * 
   * IMPORTANT FOR QAREEBLAK:
   * - If source === 'qareeblak', do NOT assign a supervisor
   * - Set supervisor_id to NULL or omit it entirely
   */
  async createOrder(orderData: {
    customer_name: string;
    customer_phone: string;
    delivery_address: string;
    source: OrderSource;
    delivery_fee: number;
    items: OrderItem[];
    supervisor_id?: number | null;
  }) {
    // Qareeblak orders should NOT have a supervisor assigned
    let supervisorId = orderData.supervisor_id;
    if (orderData.source === 'qareeblak') {
      supervisorId = null; // Explicitly set to null
    }

    const order = {
      customer_name: orderData.customer_name,
      customer_phone: orderData.customer_phone,
      delivery_address: orderData.delivery_address,
      source: orderData.source,
      delivery_fee: orderData.delivery_fee,
      items: JSON.stringify(orderData.items),
      supervisor_id: supervisorId,
      status: 'pending',
      created_at: new Date()
    };

    return await this.db('orders').insert(order);
  }

  /**
   * Get order by ID with related data
   */
  async getOrderById(id: number) {
    return await this.db('orders')
      .leftJoin('users as supervisors', 'orders.supervisor_id', 'supervisors.id')
      .leftJoin('users as couriers', 'orders.courier_id', 'couriers.id')
      .where('orders.id', '=', id)
      .select(
        'orders.*',
        'supervisors.name as supervisor_name',
        'couriers.name as courier_name'
      )
      .first();
  }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. DASHBOARD STATS SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class DashboardService {
  constructor(private db: any) {}

  /**
   * Calculate dashboard statistics
   * 
   * Key Calculation for Qareeblak:
   * - qareeblak_delivery_revenue = SUM(delivery_fee) WHERE source='qareeblak' AND status='delivered'
   * - IMPORTANT: Only includes delivery_fee, NOT product prices
   */
  async getStats(period: 'today' | 'week' | 'month') {
    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      // Start from Saturday (day 6 in JS, or treat as week start)
      const day = startDate.getDay();
      const diff = startDate.getDate() - day;
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }

    // Get all delivered orders in period
    const deliveredOrders = await this.db('orders')
      .where('status', '=', 'delivered')
      .where('created_at', '>=', startDate)
      .where('created_at', '<=', now);

    // Calculate totals
    const totalDeliveryFees = deliveredOrders.reduce(
      (sum: number, order: Order) => sum + parseFloat(order.delivery_fee.toString() || '0'),
      0
    );

    const totalSales = deliveredOrders.reduce((sum: number, order: Order) => {
      const items = typeof order.items === 'string' 
        ? JSON.parse(order.items || '[]')
        : (order.items || []);
      
      const itemsTotal = items.reduce(
        (itemSum: number, item: OrderItem) =>
          itemSum + (parseFloat(item.price.toString()) * parseFloat(item.quantity.toString())),
        0
      );

      return sum + itemsTotal + parseFloat(order.delivery_fee.toString() || '0');
    }, 0);

    // ← NEW: Calculate Qareeblak-specific metrics
    const qareeblakOrders = deliveredOrders.filter(
      (o: Order) => o.source === 'qareeblak'
    );

    const qareeblakDeliveryRevenue = qareeblakOrders.reduce(
      (sum: number, order: Order) => sum + parseFloat(order.delivery_fee.toString() || '0'),
      0
    );

    // Get all orders count
    const totalOrdersCount = await this.db('orders').count('* as total').first();

    return {
      summary: {
        total_delivery_fees: parseFloat(totalDeliveryFees.toFixed(2)),
        total_sales: parseFloat(totalSales.toFixed(2)),
        delivered: deliveredOrders.length,
        total_orders: totalOrdersCount.total,
        qareeblak_delivery_revenue: parseFloat(qareeblakDeliveryRevenue.toFixed(2)),
        qareeblak_orders_count: qareeblakOrders.length
      }
    };
  }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. EXPRESS ROUTER IMPLEMENTATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Example with Express.js
import express from 'express';
import knex from 'knex';

const router = express.Router();
const db = knex(/* config */);
const orderService = new OrderService(db);
const dashboardService = new DashboardService(db);

/**
 * GET /halan/orders
 * Get all orders with filtering
 */
router.get('/orders', async (req, res) => {
  try {
    const filters = {
      source: req.query.source as string,
      status: req.query.status as string,
      supervisorId: req.query.supervisorId ? parseInt(req.query.supervisorId as string) : undefined,
      courierId: req.query.courierId ? parseInt(req.query.courierId as string) : undefined,
      search: req.query.search as string
    };

    const orders = await orderService.getOrders(filters);

    res.json({
      success: true,
      data: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /halan/orders
 * Create a new order
 */
router.post('/orders', async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      delivery_address,
      source = 'manual',
      delivery_fee,
      items,
      supervisor_id
    } = req.body;

    // Qareeblak orders should NOT have supervisor
    let finalSupervisorId = supervisor_id;
    if (source === 'qareeblak') {
      finalSupervisorId = null; // Ensure it's null
    }

    const result = await db('orders').insert({
      customer_name,
      customer_phone,
      delivery_address,
      source,
      delivery_fee,
      items: JSON.stringify(items),
      supervisor_id: finalSupervisorId,
      status: 'pending',
      created_at: new Date()
    });

    res.json({
      success: true,
      id: result[0],
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /halan/dashboard/stats
 * Get dashboard statistics
 */
router.get('/dashboard/stats', async (req, res) => {
  try {
    const period = (req.query.period || 'today') as 'today' | 'week' | 'month';
    const stats = await dashboardService.getStats(period);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. ALTERNATIVE: Laravel/Eloquent IMPLEMENTATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Migration file: database/migrations/2026_02_add_source_to_orders.php
 */
/*
Schema::table('orders', function (Blueprint $table) {
    $table->enum('source', ['qareeblak', 'manual', 'whatsapp', 'api', 'import'])
        ->default('manual')
        ->after('status');
    
    $table->index('source');
    $table->index(['source', 'status']);
});
*/

/**
 * Model: app/Models/Order.php
 */
/*
class Order extends Model {
    protected $fillable = [
        'customer_name', 'customer_phone', 'delivery_address',
        'source', 'delivery_fee', 'items', 'supervisor_id', 'status'
    ];

    protected $casts = [
        'items' => 'array',
        'created_at' => 'datetime',
    ];

    public function scopeBySource($query, $source) {
        if ($source && $source !== 'all') {
            return $query->where('source', $source);
        }
        return $query;
    }

    public function scopeDelivered($query) {
        return $query->where('status', 'delivered');
    }
}
*/

/**
 * Service: app/Services/DashboardService.php
 */
/*
class DashboardService {
    public function getStats($period = 'today') {
        $startDate = $this->getPeriodStartDate($period);
        
        $deliveredOrders = Order::delivered()
            ->where('created_at', '>=', $startDate)
            ->get();
        
        // Qareeblak delivery revenue
        $qareeblakDeliveryRevenue = Order::delivered()
            ->bySource('qareeblak')
            ->where('created_at', '>=', $startDate)
            ->sum('delivery_fee');
        
        return [
            'qareeblak_delivery_revenue' => $qareeblakDeliveryRevenue,
            'qareeblak_orders_count' => Order::delivered()
                ->bySource('qareeblak')
                ->where('created_at', '>=', $startDate)
                ->count()
        ];
    }
}
*/

/**
 * Controller: app/Http/Controllers/OrderController.php
 */
/*
class OrderController extends Controller {
    public function index(Request $request) {
        $query = Order::query();
        
        if ($request->has('source')) {
            $query->bySource($request->source);
        }
        
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('customer_name', 'like', "%{$search}%")
                  ->orWhere('customer_phone', 'like', "%{$search}%")
                  ->orWhere('delivery_address', 'like', "%{$search}%");
            });
        }
        
        return response()->json([
            'success' => true,
            'data' => $query->orderBy('created_at', 'desc')->get()
        ]);
    }

    public function store(Request $request) {
        $data = $request->validate([
            'customer_name' => 'required|string',
            'customer_phone' => 'required|string',
            'delivery_address' => 'required|string',
            'source' => 'required|in:qareeblak,manual,whatsapp,api,import',
            'delivery_fee' => 'required|numeric',
            'items' => 'required|array'
        ]);

        // Qareeblak orders: NO supervisor
        if ($data['source'] === 'qareeblak') {
            $data['supervisor_id'] = null;
        }

        $order = Order::create($data);

        return response()->json([
            'success' => true,
            'id' => $order->id
        ]);
    }
}
*/


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. SQL QUERIES FOR TESTING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Test Queries
 */

-- Check if source column exists
-- SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'source';

-- Get all Qareeblak orders
-- SELECT * FROM orders WHERE source = 'qareeblak' ORDER BY created_at DESC;

-- Get Qareeblak delivery revenue (delivered orders only)
-- SELECT SUM(delivery_fee) as qareeblak_delivery_revenue
-- FROM orders 
-- WHERE source = 'qareeblak' AND status = 'delivered';

-- Compare sources revenue distribution
-- SELECT 
--     source,
--     COUNT(*) as order_count,
--     SUM(delivery_fee) as total_delivery_fees,
--     AVG(delivery_fee) as avg_delivery_fee
-- FROM orders
-- WHERE status = 'delivered'
-- GROUP BY source;

-- Check for orders with NULL supervisor_id
-- SELECT COUNT(*) FROM orders WHERE supervisor_id IS NULL;

-- Verify Qareeblak orders have no supervisor
-- SELECT id, source, supervisor_id FROM orders 
-- WHERE source = 'qareeblak' AND supervisor_id IS NOT NULL;


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. TESTING EXAMPLES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Unit Test Example (Jest/Mocha)
 */

/*
describe('OrderService', () => {
  describe('getOrders', () => {
    it('should filter orders by source=qareeblak', async () => {
      const orders = await orderService.getOrders({ source: 'qareeblak' });
      
      expect(orders).toBeInstanceOf(Array);
      orders.forEach(order => {
        expect(order.source).toBe('qareeblak');
      });
    });

    it('should combine source and status filters', async () => {
      const orders = await orderService.getOrders({
        source: 'qareeblak',
        status: 'delivered'
      });
      
      orders.forEach(order => {
        expect(order.source).toBe('qareeblak');
        expect(order.status).toBe('delivered');
      });
    });
  });

  describe('createOrder', () => {
    it('should NOT assign supervisor for qareeblak orders', async () => {
      const order = await orderService.createOrder({
        customer_name: 'أحمد',
        customer_phone: '01234567890',
        delivery_address: 'الحي الأول',
        source: 'qareeblak',
        delivery_fee: 25,
        items: [],
        supervisor_id: 123  // This should be ignored
      });

      const created = await orderService.getOrderById(order[0]);
      expect(created.supervisor_id).toBeNull();
    });
  });
});

describe('DashboardService', () => {
  describe('getStats', () => {
    it('should calculate qareeblak_delivery_revenue correctly', async () => {
      const stats = await dashboardService.getStats('today');
      
      expect(stats.summary).toHaveProperty('qareeblak_delivery_revenue');
      expect(stats.summary.qareeblak_delivery_revenue).toBeGreaterThanOrEqual(0);
    });

    it('should not include product prices in qareeblak revenue', async () => {
      // Create test orders
      await db('orders').insert({
        source: 'qareeblak',
        delivery_fee: 30,
        items: JSON.stringify([
          { name: 'Item1', price: 100, quantity: 1 }
        ]),
        status: 'delivered'
      });

      const stats = await dashboardService.getStats('today');
      // Revenue should be 30 (only delivery fee), not 130 (delivery + product)
      expect(stats.summary.qareeblak_delivery_revenue).toBeLessThan(130);
    });
  });
});
*/


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// END OF BACKEND EXAMPLES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
