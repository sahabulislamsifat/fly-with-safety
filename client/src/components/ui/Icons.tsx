import {
  Shield,
  Ticket,
  Headphones,
  Plane,
  Hotel,
  Package,
  FileText,
  MessageCircle,
  Share2,
  Camera,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  Search,
  ArrowRight,
  Calendar,
  Users,
  Star,
  MapPin,
  ArrowLeftRight,
  CreditCard,
  Smartphone,
  Globe,
  Tag,
  CheckCircle,
  AlertCircle,
  Loader2,
  Send,
  Mail,
  Phone,
  Edit,
  Filter,
  Info,
  Check,
  Plus,
  ChevronUp,
} from 'lucide-react';

const icons = {
  shield: Shield,
  ticket: Ticket,
  headphones: Headphones,
  plane: Plane,
  hotel: Hotel,
  package: Package,
  fileText: FileText,
  messageCircle: MessageCircle,
  facebook: Share2,
  instagram: Camera,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  menu: Menu,
  x: X,
  search: Search,
  arrowRight: ArrowRight,
  calendar: Calendar,
  users: Users,
  star: Star,
  mapPin: MapPin,
  swapHorizontal: ArrowLeftRight,
  creditCard: CreditCard,
  smartphone: Smartphone,
  globe: Globe,
  tag: Tag,
  checkCircle: CheckCircle,
  alertCircle: AlertCircle,
  loader2: Loader2,
  send: Send,
  mail: Mail,
  phone: Phone,
  edit: Edit,
  filter: Filter,
  info: Info,
  check: Check,
  plus: Plus,
  chevronUp: ChevronUp,
} as const;

export type IconName = keyof typeof icons;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  ariaHidden?: boolean;
}

export function Icon({ name, size = 20, className = '', ariaHidden = true }: IconProps) {
  const IconComponent = icons[name];
  return (
    <IconComponent
      size={size}
      className={className}
      aria-hidden={ariaHidden}
      strokeWidth={2}
    />
  );
}

export { icons };