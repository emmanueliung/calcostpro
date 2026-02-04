


export interface Material {
  id: string;
  name: string;
  price: number;
  unit: 'm' | 'piece' | 'fixed' | 'kg';
  grammage?: number; // g/mÂ²
  ancho?: number; // m (width)
}

export type QuoteMode = 'individual' | 'group';

export interface QuoteItem {
  id: string; // A unique ID for the item instance in the quote
  material: Material;
  quantity: number;
  total: number;
  type: 'Fabric' | 'Accessory' | 'Print';
}

export interface SizePrice {
  size: string;
  price: number;
  isSelected: boolean;
}

export interface GroupQuoteItem {
  id: string;
  name: string;
  baseSize: string;
  basePrice: number;
  sizes: SizePrice[];
}

export interface LaborCosts {
  labor: number;
  cutting: number;
  other: number;
}

export interface ProjectDetails {
  clientName: string;
  projectName: string;
  garmentType: string;
  description?: string;
  productImageUrl?: string;
}

// New type for a line item within a group quote
export interface LineItem {
  id: string;
  name: string;
  quantity: number;
  profitMargin: number;
  items: QuoteItem[];
  laborCosts: LaborCosts;
  sizePrices: SizePrice[];
  productImageUrls?: string[]; // Changed from productImageUrl
  description?: string;
}


// This represents a project in Firestore.
// The 'id' is the document ID from Firestore.
export interface ProjectConfiguration {
  id: string;
  userId: string; // Owner of the project
  projectDetails: {
    clientName: string;
    projectName: string;
  };
  quoteMode: QuoteMode; // Changed from quoteType

  // For both modes, we use line items
  lineItems: LineItem[];

  // DEPRECATED - to be merged into lineItems
  individualQuoteItems: QuoteItem[];
  individualLaborCosts: LaborCosts;
  sizePrices: SizePrice[];
  groupLineItems: GroupQuoteItem[];


  createdAt: any; // Stored as ISO string or server timestamp
  status?: 'En espera' | 'Enviado' | 'Aceptado';

  // New fields for fitting module
  surfaceTotale?: number;
  coutTissuTotal?: number;

  quoteSpecificConditions?: {
    validity?: string;
    deliveryTime?: string;
    deliveryPlace?: string;
    quoteDate?: string;
  };
}

export interface EmailSettings {
  senderName?: string;
  replyTo?: string;
  notifyWorkshopOnNewOrder: boolean;
  sendConfirmationToCustomer: boolean;
}

export interface UserProfileData {
  name: string;
  email: string;
  address: string;
  phone: string;
  taxId: string;
  taxPercentage: number;
  logoUrl?: string;
  qrCodeUrl?: string;
  conditions?: string;
  plan?: 'Gratuito' | 'Premium' | 'Entreprise';
  subscriptionType?: 'bonus_code' | 'permanent';
  subscriptionEndsAt?: any;
  createdAt?: any;
  status?: 'Activo' | 'Inactivo';
  materialsCatalog?: {
    fabrics: Material[];
    accessories: Material[];
    prints: Material[];
  };
  emailSettings?: EmailSettings;
}

export interface Fitting {
  id: string;
  personName: string;
  email: string;
  sizes: { [garmentId: string]: string }; // Example: { 'li-123': 'M', 'li-456': '42' }
  confirmed: boolean;
  createdAt: any; // Firestore Timestamp
  userId: string; // UID of the user who owns this record
  confirmedAt?: any;

  // Deprecated fields, to be removed later
  veste?: string;
  chemise?: string;
}

// --- WORKSHOP MODULE TYPES ---

export interface StudentMeasurements {
  height?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  sleeve?: number;
  leg?: number; // largo pierna
  shoulder?: number;
  neck?: number;
}

export interface Student {
  id: string;
  userId: string; // Owner
  college: string;
  collegeId?: string; // Reference to the price list (College)
  name: string; // "Dupont LÃ©o"
  gender?: 'Hombre' | 'Mujer';
  classroom?: string; // Clase/Curso
  measurements?: StudentMeasurements;
  sizes?: Record<string, string>; // e.g. { 'Pantalon': '38', 'Veste': 'M' }
  notes?: string;
  createdAt: any;
  sourceType?: 'school' | 'project';
  projectId?: string;
}

export type OrderType = 'sur_mesure' | 'stock';
export type OrderStatus = 'pending' | 'in_production' | 'ready' | 'delivered';

export interface OrderItem {
  productId?: string; // If stock
  productName: string; // "Polo T12" or "Uniforme completo"
  quantity: number;
  price: number;
  size?: string;
  type: OrderType;
  technicalSheetId?: string; // Link to the garment library for consumption calculation
}

export interface CollegeItem {
  id?: string;
  name: string;
  price: number;
  technicalSheetId?: string; // Link to the garment library
}

export interface College {
  id: string;
  userId: string;
  name: string; // "La Salle"
  course?: string; // "6to B" or "Promo 2026"
  priceList?: CollegeItem[];
  createdAt: any;
}

export interface Order {
  id: string;
  userId: string;
  studentId: string;
  studentName: string; // Denormalized for easy display
  studentGender?: 'Hombre' | 'Mujer';
  college: string; // Denormalized
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  paidAmount: number; // Sum of transactions
  balance: number; // total - paid
  createdAt: any;
  updatedAt: any;
  type?: 'project_fitting';
  projectId?: string;
}

export type PaymentMethod = 'cash' | 'qr';

export interface Transaction {
  id: string;
  userId: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  proofUrl?: string; // For QR screenshot
  date: any;
}

// --- PUBLIC ORDER TYPES ---

export type PublicOrderStatus =
  | 'pending_payment'      // Client a soumis, en attente de validation du paiement
  | 'payment_verified'     // Paiement validÃ© par l'admin
  | 'in_production'        // En production
  | 'ready'                // PrÃªt pour retrait
  | 'delivered'            // LivrÃ©
  | 'cancelled';           // AnnulÃ©

export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
}

export interface PublicOrder {
  id: string;
  userId: string;              // Owner of the workshop
  customer: CustomerInfo;      // Client information
  college: string;             // College name
  items: OrderItem[];          // Order items
  status: PublicOrderStatus;
  totalAmount: number;
  paymentProofUrl?: string;    // Screenshot of QR payment
  createdAt: any;
  updatedAt: any;
  adminNotes?: string;
}

// --- GARMENT LIBRARY TYPES ---

export type ComponentType = 'tissu' | 'accessoire' | 'main_d_oeuvre';

export interface SizeConsumption {
  size: string;
  consumption: number; // specific consumption for this size
}

export interface TechnicalSheetComponent {
  id: string;
  name: string;
  type: ComponentType;
  consumptionBase: number; // default or base consumption
  unit: string;
}

export interface TechnicalSheet {
  id: string;
  userId: string;
  name: string;
  category: string;
  components: TechnicalSheetComponent[];
  sizeConsumptions: SizeConsumption[]; // consumption per size (e.g. S: 0.75, XL: 1.40)
  totalLaborMinutes?: number;
  createdAt: any;
  updatedAt: any;
}
