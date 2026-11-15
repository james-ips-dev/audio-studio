import React from 'react';
import { LanguageContext } from '../../../core/useTranslation';

interface RackErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface RackErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Section 1.3: Fault Containment (`RackErrorBoundary`)
 * Catches any runtime or Web Audio exception inside the RileyRack 800 panel
 * without crashing the host Studio Suite shell.
 */
export class RackErrorBoundary extends React.Component<
  RackErrorBoundaryProps,
  RackErrorBoundaryState
> {
  public state: RackErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): RackErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Unexpected RileyRack 800 runtime fault.',
    };
  }

  public componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[RileyRack 800 Fault Containment]:', error, info);
  }

  private handleRecover = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <LanguageContext.Consumer>
        {({ language }) => (
          <div className="inst-rileyrack w-full h-full flex items-center justify-center p-6 bg-[#080A0F] text-gray-200">
            <div className="max-w-lg w-full rounded-xl border border-amber-500/40 bg-[#10141E] p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 font-studio-mono text-[10px] font-bold text-amber-300 uppercase">
                  RACK FAULT ISOLATED
                </span>
                <h2 className="text-sm font-bold text-white">
                  {language === 'ja'
                    ? 'RILEYRACK 800 モジュール保護セーフモード'
                    : 'RILEYRACK 800 Fault Containment Active'}
                </h2>
              </div>
              <p className="text-xs text-gray-300 font-studio-mono bg-black/50 p-3 rounded border border-white/10 break-words">
                {this.state.errorMessage}
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={this.handleRecover}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-black font-studio-mono text-xs font-bold hover:bg-amber-400 cursor-pointer"
                >
                  {language === 'ja'
                    ? '↻ ラックを再初期化して復帰'
                    : '↻ Reset & Recover RileyRack 800'}
                </button>
              </div>
            </div>
          </div>
        )}
      </LanguageContext.Consumer>
    );
  }
}
