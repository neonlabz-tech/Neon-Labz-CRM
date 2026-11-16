import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60 cursor-pointer",
  {
    variants: {
      variant: {
        primary: "brand-gradient text-white shadow-sm hover:brightness-110",
        secondary: "bg-brand-50 text-brand-700 hover:bg-brand-100",
        outline: "border border-line bg-white text-ink hover:bg-brand-50",
        danger: "bg-danger text-white hover:brightness-110",
        ghost: "text-muted hover:bg-brand-50 hover:text-brand-700",
      },
      size: { sm: "h-8 rounded-lg px-3 text-xs", iconSm: "h-8 w-8 rounded-lg p-0 [&_svg]:h-4 [&_svg]:w-4", md: "h-11 px-5", icon: "h-10 w-10" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>;

export function Button({ className, variant, size, type = "button", ...props }: Props) {
  return <button type={type} className={cn(button({ variant, size }), className)} {...props} />;
}
