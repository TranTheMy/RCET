import Spline from '@splinetool/react-spline';

type Props = {
  scene: string;
  className?: string;
};

/** Tách chunk riêng để trang Home tải nhẹ hơn; mount khi section vào viewport. */
export default function HomeCapabilitiesSpline({ scene, className }: Props) {
  return <Spline scene={scene} className={className} />;
}
