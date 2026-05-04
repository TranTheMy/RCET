import React from 'react';

type Props = {
  children: React.ReactNode;
  fallback: React.ReactNode;
};

type State = { hasError: boolean };

/**
 * Bắt lỗi render từ @splinetool/react-spline; fallback về nền CSS.
 * (Lỗi trong effect/async có thể vẫn thoát — khi đó trình duyệt có thể log nhưng không unmount cả app.)
 */
export class HeroSplineBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
