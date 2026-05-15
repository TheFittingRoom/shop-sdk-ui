import { ButtonT } from '@/components/button'

interface AddToCartButtonProps {
  onClick: () => void
}

export function AddToCartButton({ onClick }: AddToCartButtonProps) {
  return <ButtonT variant="brand" t="vto-single.add_to_cart" onClick={onClick} />
}
