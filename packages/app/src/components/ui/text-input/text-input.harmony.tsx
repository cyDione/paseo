import { forwardRef, useCallback, useImperativeHandle, useReducer, useRef, useState } from "react";
import { TextInput } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useIsInsideBottomSheet } from "@/components/ui/bottom-sheet-scope";
import type { EditingTextInputHandle, EditingTextInputProps } from "./types";

export const EditingTextInput = forwardRef<EditingTextInputHandle, EditingTextInputProps>(
  function EditingTextInputHarmony(
    {
      initialValue = "",
      onChangeText,
      onPasteImages: _onPasteImages,
      onPasteError: _onPasteError,
      variant,
      ...props
    },
    ref,
  ) {
    // Harmony's RN TextInput handles text paste. Clipboard images use the
    // composer's existing attachment > Paste image action (expo-clipboard).
    const isInsideBottomSheet = useIsInsideBottomSheet();
    const inputRef = useRef<TextInput | null>(null);
    const textRef = useRef(initialValue);
    const awaitingReplacement = useRef(false);
    const [replacement, setReplacement] = useState({ revision: 0, autoFocus: false });
    const [, publishText] = useReducer((revision: number) => revision + 1, 0);
    const assignInput = useCallback((input: TextInput | null | undefined) => {
      inputRef.current = input ?? null;
      if (input) awaitingReplacement.current = false;
    }, []);

    useImperativeHandle(ref, () => ({
      focus: () => {
        if (awaitingReplacement.current) {
          setReplacement((current) => ({ ...current, autoFocus: true }));
        } else inputRef.current?.focus();
      },
      blur: () => {
        if (awaitingReplacement.current) {
          setReplacement((current) => ({ ...current, autoFocus: false }));
        } else inputRef.current?.blur();
      },
      isFocused: () => inputRef.current?.isFocused() ?? false,
      getText: () => textRef.current,
      replaceText: (text, selection) => {
        textRef.current = text;
        if (text.length === 0) inputRef.current?.clear();
        else inputRef.current?.setNativeProps({ text, ...(selection ? { selection } : {}) });
        publishText();
      },
      reset: () => {
        const autoFocus = inputRef.current?.isFocused() ?? false;
        textRef.current = "";
        inputRef.current?.clear();
        awaitingReplacement.current = true;
        setReplacement((current) => ({ revision: current.revision + 1, autoFocus }));
      },
      getNativeRef: () => inputRef.current,
    }));
    const handleChangeText = useCallback(
      (text: string) => {
        textRef.current = text;
        onChangeText?.(text);
        publishText();
      },
      [onChangeText],
    );
    const autoFocus = replacement.revision === 0 ? props.autoFocus : replacement.autoFocus;
    const Input =
      (variant ?? (isInsideBottomSheet ? "bottom-sheet" : "default")) === "bottom-sheet"
        ? BottomSheetTextInput
        : TextInput;
    return (
      <Input
        {...props}
        ref={assignInput}
        key={replacement.revision}
        autoFocus={autoFocus}
        defaultValue={textRef.current}
        onChangeText={handleChangeText}
      />
    );
  },
);
