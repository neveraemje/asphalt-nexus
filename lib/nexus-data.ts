export type ProductPlatform = {
  name: string
  slug: string
  href: string
  active?: boolean
  description: string
  categories: string[]
}

export type Category = {
  name: string
  slug: string
  app: string
  count?: number
}

export type ScreenCard = {
  id: string
  title: string
  platform: string
  app: "consumer" | "merchant" | "driver"
  category: string
  count: string
  image: string
  href: string
}

export type AppSlug = ScreenCard["app"]

type SearchParamReader = {
  get: (name: string) => string | null
}

export type ArchitectureGroup = {
  title: string
  items: string[]
}

export type ScreenVariant = {
  id: number
  title: string
  platform: string
  app: ScreenCard["app"]
  category: string
  image: string
  href: string
  pulls: number
  size: string
  views: number
  architecture: ArchitectureGroup[]
}

export const platforms: ProductPlatform[] = [
  {
    name: "Consumer App",
    slug: "consumer",
    href: "/?app=consumer",
    description: "End-user mobile application for Gojek ride-hailing, food delivery, logistics, and lifestyle services.",
    categories: ["Customer Platform", "Transport", "Gofood", "GoMart", "Gosend"],
  },
  {
    name: "Merchant App",
    slug: "merchant",
    href: "/?app=merchant",
    description: "GoBiz merchant partner application for managing food orders, menus, transactions, and store operations.",
    categories: ["Store Dashboard", "Order Management", "Menu & Catalog", "Settlements & Finance", "Promo & Growth"],
  },
  {
    name: "Driver App",
    slug: "driver",
    href: "/?app=driver",
    description: "GoPartner driver application for order dispatch, turn-by-turn navigation, daily earnings, and safety tools.",
    categories: ["Driver Portal", "Order Dispatch", "Navigation & Trips", "Income & Incentives", "Safety & Vehicle"],
  },
]

export const categoriesByApp: Record<string, string[]> = {
  consumer: ["Customer Platform", "Transport", "Gofood", "GoMart", "Gosend"],
  merchant: ["Store Dashboard", "Order Management", "Menu & Catalog", "Settlements & Finance", "Promo & Growth"],
  driver: ["Driver Portal", "Order Dispatch", "Navigation & Trips", "Income & Incentives", "Safety & Vehicle"],
}

export const categories: Category[] = [
  // Consumer App Categories
  { name: "Customer Platform", slug: "customer-platform", app: "consumer" },
  { name: "Transport", slug: "transport", app: "consumer" },
  { name: "Gofood", slug: "gofood", app: "consumer" },
  { name: "GoMart", slug: "gomart", app: "consumer" },
  { name: "Gosend", slug: "gosend", app: "consumer" },

  // Merchant App Categories
  { name: "Store Dashboard", slug: "store-dashboard", app: "merchant" },
  { name: "Order Management", slug: "order-management", app: "merchant" },
  { name: "Menu & Catalog", slug: "menu-catalog", app: "merchant" },
  { name: "Settlements & Finance", slug: "settlements-finance", app: "merchant" },
  { name: "Promo & Growth", slug: "promo-growth", app: "merchant" },

  // Driver App Categories
  { name: "Driver Portal", slug: "driver-portal", app: "driver" },
  { name: "Order Dispatch", slug: "order-dispatch", app: "driver" },
  { name: "Navigation & Trips", slug: "navigation-trips", app: "driver" },
  { name: "Income & Incentives", slug: "income-incentives", app: "driver" },
  { name: "Safety & Vehicle", slug: "safety-vehicle", app: "driver" },
]

const baseScreenCards: Omit<ScreenCard, "href">[] = [
  // ==========================================
  // CONSUMER APP SCREENS
  // ==========================================
  // Customer Platform
  {
    id: "c-cp-1",
    title: "Home Screen",
    platform: "Customer Platform",
    app: "consumer",
    category: "Customer Platform",
    count: "40 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "c-cp-2",
    title: "Promo & Discounts",
    platform: "Customer Platform",
    app: "consumer",
    category: "Customer Platform",
    count: "24 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "c-cp-3",
    title: "Profile & Account",
    platform: "Customer Platform",
    app: "consumer",
    category: "Customer Platform",
    count: "18 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },
  {
    id: "c-cp-4",
    title: "Order History & Activity",
    platform: "Customer Platform",
    app: "consumer",
    category: "Customer Platform",
    count: "32 Screens",
    image: "/screen-sample/cp-home-long.png",
  },
  {
    id: "c-cp-5",
    title: "Chat & Notifications",
    platform: "Customer Platform",
    app: "consumer",
    category: "Customer Platform",
    count: "15 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "c-cp-6",
    title: "GoClub Rewards Program",
    platform: "Customer Platform",
    app: "consumer",
    category: "Customer Platform",
    count: "20 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },

  // Transport
  {
    id: "c-tr-1",
    title: "GoRide Instant Booking",
    platform: "Transport",
    app: "consumer",
    category: "Transport",
    count: "28 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "c-tr-2",
    title: "GoCar XL Vehicle Selection",
    platform: "Transport",
    app: "consumer",
    category: "Transport",
    count: "35 Screens",
    image: "/screen-sample/cp-home-long.png",
  },
  {
    id: "c-tr-3",
    title: "Live Route Map & ETA",
    platform: "Transport",
    app: "consumer",
    category: "Transport",
    count: "22 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "c-tr-4",
    title: "Ride Rating & Driver Tip",
    platform: "Transport",
    app: "consumer",
    category: "Transport",
    count: "14 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },
  {
    id: "c-tr-5",
    title: "GoTransit Commute Pass",
    platform: "Transport",
    app: "consumer",
    category: "Transport",
    count: "19 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "c-tr-6",
    title: "Scheduled Ride Booking",
    platform: "Transport",
    app: "consumer",
    category: "Transport",
    count: "12 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },

  // GoFood
  {
    id: "c-gf-1",
    title: "Food Discovery & Feed",
    platform: "Gofood",
    app: "consumer",
    category: "Gofood",
    count: "45 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "c-gf-2",
    title: "Group Order Lobby",
    platform: "Gofood",
    app: "consumer",
    category: "Gofood",
    count: "30 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },
  {
    id: "c-gf-3",
    title: "Dish Modifiers & Toppings",
    platform: "Gofood",
    app: "consumer",
    category: "Gofood",
    count: "26 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "c-gf-4",
    title: "Multi-Restaurant Cart",
    platform: "Gofood",
    app: "consumer",
    category: "Gofood",
    count: "21 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },
  {
    id: "c-gf-5",
    title: "Live Food Delivery Tracking",
    platform: "Gofood",
    app: "consumer",
    category: "Gofood",
    count: "38 Screens",
    image: "/screen-sample/cp-home-long.png",
  },
  {
    id: "c-gf-6",
    title: "Budget Meals & Deals",
    platform: "Gofood",
    app: "consumer",
    category: "Gofood",
    count: "16 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },

  // GoMart
  {
    id: "c-gm-1",
    title: "Supermarket Aisles Catalog",
    platform: "GoMart",
    app: "consumer",
    category: "GoMart",
    count: "36 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "c-gm-2",
    title: "Fresh Groceries & Dairy",
    platform: "GoMart",
    app: "consumer",
    category: "GoMart",
    count: "25 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "c-gm-3",
    title: "Out-of-Stock Substitution",
    platform: "GoMart",
    app: "consumer",
    category: "GoMart",
    count: "18 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },
  {
    id: "c-gm-4",
    title: "Instant Slot Delivery",
    platform: "GoMart",
    app: "consumer",
    category: "GoMart",
    count: "14 Screens",
    image: "/screen-sample/cp-home-long.png",
  },
  {
    id: "c-gm-5",
    title: "Smart Grocery Checklist",
    platform: "GoMart",
    app: "consumer",
    category: "GoMart",
    count: "20 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "c-gm-6",
    title: "Checkout & Bagging Choice",
    platform: "GoMart",
    app: "consumer",
    category: "GoMart",
    count: "12 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },

  // GoSend
  {
    id: "c-gs-1",
    title: "Sender & Recipient Pinpoint",
    platform: "Gosend",
    app: "consumer",
    category: "Gosend",
    count: "24 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "c-gs-2",
    title: "Package Weight & Dimensions",
    platform: "Gosend",
    app: "consumer",
    category: "Gosend",
    count: "16 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },
  {
    id: "c-gs-3",
    title: "Live Courier Map & Status",
    platform: "Gosend",
    app: "consumer",
    category: "Gosend",
    count: "29 Screens",
    image: "/screen-sample/cp-home-long.png",
  },
  {
    id: "c-gs-4",
    title: "Photo Proof of Delivery",
    platform: "Gosend",
    app: "consumer",
    category: "Gosend",
    count: "15 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "c-gs-5",
    title: "Multi-Stop Dispatch Route",
    platform: "Gosend",
    app: "consumer",
    category: "Gosend",
    count: "22 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "c-gs-6",
    title: "Intercity Freight Logistics",
    platform: "Gosend",
    app: "consumer",
    category: "Gosend",
    count: "19 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },

  // ==========================================
  // MERCHANT APP SCREENS (GoBiz)
  // ==========================================
  // Store Dashboard
  {
    id: "m-sd-1",
    title: "Outlet Status & Switcher",
    platform: "Store Dashboard",
    app: "merchant",
    category: "Store Dashboard",
    count: "22 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "m-sd-2",
    title: "Daily Revenue & Peak Hours",
    platform: "Store Dashboard",
    app: "merchant",
    category: "Store Dashboard",
    count: "30 Screens",
    image: "/screen-sample/cp-home-long.png",
  },
  {
    id: "m-sd-3",
    title: "Operational Hours & Holiday",
    platform: "Store Dashboard",
    app: "merchant",
    category: "Store Dashboard",
    count: "14 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "m-sd-4",
    title: "Customer Reviews & Ratings",
    platform: "Store Dashboard",
    app: "merchant",
    category: "Store Dashboard",
    count: "19 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },
  {
    id: "m-sd-5",
    title: "Store Performance Scorecard",
    platform: "Store Dashboard",
    app: "merchant",
    category: "Store Dashboard",
    count: "25 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "m-sd-6",
    title: "Staff Role & Access Control",
    platform: "Store Dashboard",
    app: "merchant",
    category: "Store Dashboard",
    count: "16 Screens",
    image: "/screen-sample/cp-home.png",
  },

  // Order Management
  {
    id: "m-om-1",
    title: "Incoming Orders Live Feed",
    platform: "Order Management",
    app: "merchant",
    category: "Order Management",
    count: "42 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "m-om-2",
    title: "Kitchen Order Ticket (KOT)",
    platform: "Order Management",
    app: "merchant",
    category: "Order Management",
    count: "28 Screens",
    image: "/screen-sample/cp-home-long.png",
  },
  {
    id: "m-om-3",
    title: "Order Ready for Pickup",
    platform: "Order Management",
    app: "merchant",
    category: "Order Management",
    count: "20 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },
  {
    id: "m-om-4",
    title: "Driver Handover Verification",
    platform: "Order Management",
    app: "merchant",
    category: "Order Management",
    count: "17 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "m-om-5",
    title: "Order Cancellation & Dispute",
    platform: "Order Management",
    app: "merchant",
    category: "Order Management",
    count: "23 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "m-om-6",
    title: "Completed Orders Archive",
    platform: "Order Management",
    app: "merchant",
    category: "Order Management",
    count: "31 Screens",
    image: "/screen-sample/cp-home-long.png",
  },

  // Menu & Catalog
  {
    id: "m-mc-1",
    title: "Digital Menu Hierarchy",
    platform: "Menu & Catalog",
    app: "merchant",
    category: "Menu & Catalog",
    count: "38 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "m-mc-2",
    title: "Variant & Topping Matrix",
    platform: "Menu & Catalog",
    app: "merchant",
    category: "Menu & Catalog",
    count: "27 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },
  {
    id: "m-mc-3",
    title: "Dish Photo & Banner Uploader",
    platform: "Menu & Catalog",
    app: "merchant",
    category: "Menu & Catalog",
    count: "21 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "m-mc-4",
    title: "Instant Stock Out-of-Stock",
    platform: "Menu & Catalog",
    app: "merchant",
    category: "Menu & Catalog",
    count: "15 Screens",
    image: "/screen-sample/cp-home-long.png",
  },
  {
    id: "m-mc-5",
    title: "Combo Meal Builder",
    platform: "Menu & Catalog",
    app: "merchant",
    category: "Menu & Catalog",
    count: "29 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "m-mc-6",
    title: "Bulk Pricing & Tax Adjuster",
    platform: "Menu & Catalog",
    app: "merchant",
    category: "Menu & Catalog",
    count: "18 Screens",
    image: "/screen-sample/cp-home.png",
  },

  // Settlements & Finance
  {
    id: "m-sf-1",
    title: "Daily Net Payout Summary",
    platform: "Settlements & Finance",
    app: "merchant",
    category: "Settlements & Finance",
    count: "33 Screens",
    image: "/screen-sample/cp-home-long.png",
  },
  {
    id: "m-sf-2",
    title: "Bank Account & Auto Payout",
    platform: "Settlements & Finance",
    app: "merchant",
    category: "Settlements & Finance",
    count: "19 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "m-sf-3",
    title: "Commission & Tax Breakdown",
    platform: "Settlements & Finance",
    app: "merchant",
    category: "Settlements & Finance",
    count: "24 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "m-sf-4",
    title: "Cash Drawer Reconciliation",
    platform: "Settlements & Finance",
    app: "merchant",
    category: "Settlements & Finance",
    count: "16 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },
  {
    id: "m-sf-5",
    title: "Monthly Financial Statement",
    platform: "Settlements & Finance",
    app: "merchant",
    category: "Settlements & Finance",
    count: "28 Screens",
    image: "/screen-sample/cp-home-long.png",
  },
  {
    id: "m-sf-6",
    title: "Transaction Dispute Center",
    platform: "Settlements & Finance",
    app: "merchant",
    category: "Settlements & Finance",
    count: "12 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },

  // Promo & Growth
  {
    id: "m-pg-1",
    title: "Merchant-Funded Discounts",
    platform: "Promo & Growth",
    app: "merchant",
    category: "Promo & Growth",
    count: "26 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "m-pg-2",
    title: "Flash Sale & Happy Hour Setup",
    platform: "Promo & Growth",
    app: "merchant",
    category: "Promo & Growth",
    count: "22 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },
  {
    id: "m-pg-3",
    title: "Co-Funded GoFood Campaigns",
    platform: "Promo & Growth",
    app: "merchant",
    category: "Promo & Growth",
    count: "30 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "m-pg-4",
    title: "In-App Banner Ads Manager",
    platform: "Promo & Growth",
    app: "merchant",
    category: "Promo & Growth",
    count: "18 Screens",
    image: "/screen-sample/cp-home-long.png",
  },
  {
    id: "m-pg-5",
    title: "Customer Loyalty Vouchers",
    platform: "Promo & Growth",
    app: "merchant",
    category: "Promo & Growth",
    count: "21 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "m-pg-6",
    title: "Campaign ROI & Analytics",
    platform: "Promo & Growth",
    app: "merchant",
    category: "Promo & Growth",
    count: "17 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },

  // ==========================================
  // DRIVER APP SCREENS (GoPartner)
  // ==========================================
  // Driver Portal
  {
    id: "d-dp-1",
    title: "Online / Offline Switch",
    platform: "Driver Portal",
    app: "driver",
    category: "Driver Portal",
    count: "29 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "d-dp-2",
    title: "High Demand Area Heatmap",
    platform: "Driver Portal",
    app: "driver",
    category: "Driver Portal",
    count: "36 Screens",
    image: "/screen-sample/cp-home-long.png",
  },
  {
    id: "d-dp-3",
    title: "Driver Star Rating & Tier",
    platform: "Driver Portal",
    app: "driver",
    category: "Driver Portal",
    count: "21 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "d-dp-4",
    title: "Acceptance & Completion Rate",
    platform: "Driver Portal",
    app: "driver",
    category: "Driver Portal",
    count: "24 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },
  {
    id: "d-dp-5",
    title: "Daily Bonus Goal Progress",
    platform: "Driver Portal",
    app: "driver",
    category: "Driver Portal",
    count: "18 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "d-dp-6",
    title: "Partner Announcements Hub",
    platform: "Driver Portal",
    app: "driver",
    category: "Driver Portal",
    count: "14 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },

  // Order Dispatch
  {
    id: "d-od-1",
    title: "Incoming GoRide Order Offer",
    platform: "Order Dispatch",
    app: "driver",
    category: "Order Dispatch",
    count: "40 Screens",
    image: "/screen-sample/cp-home-long.png",
  },
  {
    id: "d-od-2",
    title: "GoFood Merchant Pickup Notice",
    platform: "Order Dispatch",
    app: "driver",
    category: "Order Dispatch",
    count: "34 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "d-od-3",
    title: "Multi-Order Batching Queue",
    platform: "Order Dispatch",
    app: "driver",
    category: "Order Dispatch",
    count: "27 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },
  {
    id: "d-od-4",
    title: "Auto-Accept Route Filter",
    platform: "Order Dispatch",
    app: "driver",
    category: "Order Dispatch",
    count: "19 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "d-od-5",
    title: "Customer Cancellation Alert",
    platform: "Order Dispatch",
    app: "driver",
    category: "Order Dispatch",
    count: "16 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "d-od-6",
    title: "Airport Queue Dispatch",
    platform: "Order Dispatch",
    app: "driver",
    category: "Order Dispatch",
    count: "23 Screens",
    image: "/screen-sample/cp-home-long.png",
  },

  // Navigation & Trips
  {
    id: "d-nt-1",
    title: "Turn-by-Turn GPS Navigation",
    platform: "Navigation & Trips",
    app: "driver",
    category: "Navigation & Trips",
    count: "44 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "d-nt-2",
    title: "In-Trip Passenger Chat & VOIP",
    platform: "Navigation & Trips",
    app: "driver",
    category: "Navigation & Trips",
    count: "25 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },
  {
    id: "d-nt-3",
    title: "Arrived at Pickup Pinpoint",
    platform: "Navigation & Trips",
    app: "driver",
    category: "Navigation & Trips",
    count: "20 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "d-nt-4",
    title: "Drop-off & E-Receipt Handover",
    platform: "Navigation & Trips",
    app: "driver",
    category: "Navigation & Trips",
    count: "18 Screens",
    image: "/screen-sample/cp-home-long.png",
  },
  {
    id: "d-nt-5",
    title: "Toll & Parking Fee Input",
    platform: "Navigation & Trips",
    app: "driver",
    category: "Navigation & Trips",
    count: "15 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "d-nt-6",
    title: "Traffic Congestion Re-routing",
    platform: "Navigation & Trips",
    app: "driver",
    category: "Navigation & Trips",
    count: "22 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },

  // Income & Incentives
  {
    id: "d-ii-1",
    title: "Daily Income Summary",
    platform: "Income & Incentives",
    app: "driver",
    category: "Income & Incentives",
    count: "37 Screens",
    image: "/screen-sample/cp-home-long.png",
  },
  {
    id: "d-ii-2",
    title: "Instant GoPay Cash Out",
    platform: "Income & Incentives",
    app: "driver",
    category: "Income & Incentives",
    count: "26 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "d-ii-3",
    title: "Weekly Incentive Tier Tracker",
    platform: "Income & Incentives",
    app: "driver",
    category: "Income & Incentives",
    count: "31 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "d-ii-4",
    title: "Passenger Tips & Rewards Log",
    platform: "Income & Incentives",
    app: "driver",
    category: "Income & Incentives",
    count: "19 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },
  {
    id: "d-ii-5",
    title: "Fuel Allowance & Partner Rebate",
    platform: "Income & Incentives",
    app: "driver",
    category: "Income & Incentives",
    count: "16 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "d-ii-6",
    title: "Tax Statement & Deductions",
    platform: "Income & Incentives",
    app: "driver",
    category: "Income & Incentives",
    count: "13 Screens",
    image: "/screen-sample/cp-home-long.png",
  },

  // Safety & Vehicle
  {
    id: "d-sv-1",
    title: "Emergency 24/7 SOS Center",
    platform: "Safety & Vehicle",
    app: "driver",
    category: "Safety & Vehicle",
    count: "28 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "d-sv-2",
    title: "Trip Share Live Location",
    platform: "Safety & Vehicle",
    app: "driver",
    category: "Safety & Vehicle",
    count: "22 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
  {
    id: "d-sv-3",
    title: "Mask & Sanitizer Verification",
    platform: "Safety & Vehicle",
    app: "driver",
    category: "Safety & Vehicle",
    count: "17 Screens",
    image: "/screen-sample/gofood-group-order.png",
  },
  {
    id: "d-sv-4",
    title: "Driver License & Doc Vault",
    platform: "Safety & Vehicle",
    app: "driver",
    category: "Safety & Vehicle",
    count: "25 Screens",
    image: "/screen-sample/cp-home-long.png",
  },
  {
    id: "d-sv-5",
    title: "Vehicle Health Checklist",
    platform: "Safety & Vehicle",
    app: "driver",
    category: "Safety & Vehicle",
    count: "19 Screens",
    image: "/screen-sample/cp-home.png",
  },
  {
    id: "d-sv-6",
    title: "Insurance & Accident Claim",
    platform: "Safety & Vehicle",
    app: "driver",
    category: "Safety & Vehicle",
    count: "15 Screens",
    image: "/screen-sample/gofood-merchant.png",
  },
]

export const screenCards: ScreenCard[] = baseScreenCards.map((screen) => ({
  ...screen,
  href: `/gallery/home-screen?id=${screen.id}`,
}))

export function getScreenById(id?: string | null): ScreenCard {
  if (!id) return screenCards[0]
  const found = screenCards.find((s) => s.id === id)
  return found || screenCards[0]
}

export function resolveAppSlug(app?: string | null): AppSlug {
  if (app === "merchant") return "merchant"
  if (app === "driver") return "driver"
  return "consumer"
}

export function getActiveAppFromParams(searchParams: SearchParamReader): AppSlug {
  const screenId = searchParams.get("id")
  if (screenId) {
    const selectedScreen = screenCards.find((screen) => screen.id === screenId)
    if (selectedScreen) return selectedScreen.app
  }

  return resolveAppSlug(searchParams.get("app"))
}

const previewImages = [
  "/screen-sample/cp-home.png",
  "/screen-sample/gofood-merchant.png",
  "/screen-sample/gofood-group-order.png",
  "/screen-sample/cp-home-long.png",
]

const variantTitleTemplates = [
  "Default Experience",
  "Discovery Landing",
  "Promo Entry",
  "Account State",
  "Activity Feed",
  "Empty State",
  "Search Results",
  "Category Browse",
  "Order Summary",
  "Payment Review",
  "Confirmation",
  "Error Recovery",
  "Notification State",
  "Loyalty Entry",
  "Compact Layout",
]

const architectureTemplates: ArchitectureGroup[][] = [
  [
    { title: "Header", items: ["Search", "GoStar membership entry"] },
    { title: "Hero", items: ["Ramadan campaign banner", "GoRide", "GoCar", "GoFood"] },
    { title: "More Services", items: ["Gomart", "GoPay Pinjam", "Gofood Hemar", "GoTransit"] },
    { title: "Gopay Wallet", items: ["Balance & coins", "Top up", "Loan", "More financial actions..."] },
  ],
  [
    { title: "Header", items: ["Back action", "Screen title", "Context filter"] },
    { title: "Catalog", items: ["Featured aisle", "Fresh produce", "Daily essentials", "Household picks"] },
    { title: "Selection", items: ["Quantity stepper", "Substitution option", "Delivery slot"] },
    { title: "Checkout", items: ["Basket summary", "Voucher entry", "Payment method"] },
  ],
  [
    { title: "Header", items: ["Location chip", "Search", "Quick settings"] },
    { title: "Promotions", items: ["Campaign banner", "Voucher rail", "Flash sale card"] },
    { title: "Recommendations", items: ["Personalized list", "Recently ordered", "Sponsored item"] },
    { title: "Status", items: ["Loading skeleton", "Unavailable item", "Retry action"] },
  ],
]

function seededOffset(seed: string) {
  return seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

function formatViews(value: number) {
  return value.toLocaleString("en-US")
}

export function getGalleryScreens(screenId?: string | null): ScreenVariant[] {
  const currentScreen = getScreenById(screenId)
  const parsedCount = parseInt(currentScreen.count.replace(/\D/g, ""), 10) || 15
  const sampleCount = Math.min(parsedCount, 15)
  const offset = seededOffset(currentScreen.id)

  return Array.from({ length: sampleCount }, (_, index) => ({
    id: index + 1,
    title: `${currentScreen.title} - ${variantTitleTemplates[(index + offset) % variantTitleTemplates.length]}`,
    platform: currentScreen.platform,
    app: currentScreen.app,
    category: currentScreen.category,
    image: previewImages[(index + offset) % previewImages.length],
    pulls: 12 + ((index + offset) * 7) % 42,
    size: index % 4 === 3 ? "393×2450" : "393×852",
    views: 640 + ((index + 1) * (offset % 37 + 19)),
    architecture: architectureTemplates[(index + offset) % architectureTemplates.length],
    href: `/gallery/home-screen/detail?id=${currentScreen.id}&variant=${index + 1}`,
  }))
}

export function getGalleryVariant(
  screenId?: string | null,
  variant?: string | null
): ScreenVariant {
  const screens = getGalleryScreens(screenId)
  const parsedVariant = parseInt(variant || "1", 10)
  const index = Number.isFinite(parsedVariant)
    ? Math.max(0, Math.min(screens.length - 1, parsedVariant - 1))
    : 0

  return screens[index]
}

export const galleryScreens = getGalleryScreens()

export const architecture: ArchitectureGroup[] = architectureTemplates[0]

export { formatViews }
