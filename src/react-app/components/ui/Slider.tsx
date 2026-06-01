import { Slider as BaseSlider } from "@base-ui/react/slider";
import { forwardRef } from "react";

interface SliderProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  className?: string;
  disabled?: boolean;
}

export const Slider = forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      value,
      defaultValue,
      min = 0,
      max = 100,
      step = 1,
      onChange,
      className = "",
      disabled = false,
    },
    ref,
  ) => {
    return (
      <BaseSlider.Root
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        min={min}
        max={max}
        step={step}
        onValueChange={onChange}
        disabled={disabled}
        className={className}
      >
        <BaseSlider.Control className="relative flex items-center w-full h-2 touch-none select-none">
          <BaseSlider.Track className="relative h-2 flex-1 rounded-lg bg-gray-700">
            <BaseSlider.Indicator className="absolute h-full bg-green-500 rounded-lg" />
            <BaseSlider.Thumb
              aria-label="Volume"
              className="block w-5 h-5 bg-white rounded-full shadow-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500/50"
            />
          </BaseSlider.Track>
        </BaseSlider.Control>
      </BaseSlider.Root>
    );
  },
);

Slider.displayName = "Slider";
