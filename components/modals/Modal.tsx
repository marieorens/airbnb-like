"use client";
import React, {
  FC,
  ReactElement,
  ReactNode,
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoMdClose } from "react-icons/io";
import { createPortal } from "react-dom";

import { useOutsideClick } from "@/hooks/useOutsideClick";
import { useIsClient } from "@/hooks/useIsClient";
import { useKeyPress } from "@/hooks/useKeyPress";
import { fadeIn, slideIn } from "@/utils/motion";

interface ModalProps {
  children: ReactNode;
}

interface TriggerProps {
  name: string;
  children: ReactElement;
}

interface WindowProps extends TriggerProps { }

interface WindowHeaderProps {
  title: string;
  subtitle?: string;
}

const ModalContext = createContext({
  open: (val: string) => { },
  close: () => { },
  openName: "",
});

const Modal: FC<ModalProps> & {
  Trigger: typeof Trigger;
  Window: typeof Window;
  WindowHeader: typeof WindowHeader;
} = ({ children }) => {
  const [openName, setOpenName] = useState("");

  const close = useCallback(() => {
    setOpenName("");
  }, []);

  const open = setOpenName;
  return (
    <ModalContext.Provider
      value={{
        open,
        close,
        openName,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

const Trigger: FC<TriggerProps> = ({ children, name }) => {
  const { open } = useContext(ModalContext);
  const onClick = (e: MouseEvent | TouchEvent) => {
    open(name);
  };
  return cloneElement(children, { onClick });
};

const Window: FC<WindowProps> = ({ children, name }) => {
  const { openName, close } = useContext(ModalContext);
  const isWindowOpen = openName === name;
  const { ref } = useOutsideClick({
    action: close,
    enable: isWindowOpen,
  });

  useKeyPress({
    key: "Escape",
    action: close,
    enable: isWindowOpen
  })

  const isClient = useIsClient();


  useEffect(() => {
    if (!isClient) return;
    const body = document.body;
    const rootNode = document.documentElement;
    if (isWindowOpen) {
      const scrollTop = rootNode.scrollTop;
      body.style.top = `-${scrollTop}px`;
      body.classList.add("no-scroll");
    } else {
      const top = parseFloat(body.style.top) * -1;
      body.classList.remove("no-scroll");
      if (top) {
        rootNode.scrollTop = top;
        body.style.top = "";
      }
    }
  }, [isClient, isWindowOpen]);

  if (!isClient) return null;

  return createPortal(
    <AnimatePresence>
      {isWindowOpen ? (
        <motion.div
          variants={fadeIn}
          animate="show"
          initial="hidden"
          exit="hidden"
          className="fixed inset-0 z-50 flex h-full w-full items-end justify-center overflow-hidden bg-neutral-950/75 px-0 outline-none backdrop-blur-md focus:outline-none md:items-center md:px-5"
        >
          <div className="relative w-full md:max-w-[920px]">
            <motion.div
              variants={slideIn("up", "tween", 0.3)}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="h-[100dvh] w-full overflow-hidden rounded-t-[28px] border border-white/20 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)] md:h-[92dvh] md:rounded-[28px]"
              ref={ref}
            >
              {cloneElement(children, { onCloseModal: close })}
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};

const WindowHeader: FC<WindowHeaderProps> = ({ title, subtitle }) => {
  const { close } = useContext(ModalContext);
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-neutral-200/80 bg-white/95 px-5 py-4 backdrop-blur md:px-7">
      <div className="min-w-0">
        
        <h4 className="truncate text-[18px] font-black leading-tight text-neutral-950 md:text-[20px]">
          {title}
        </h4>
        {subtitle ? (
          <p className="mt-1 line-clamp-1 text-xs font-medium text-neutral-500">
            {subtitle}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-700 transition hover:bg-neutral-950 hover:text-white"
        onClick={close}
        aria-label="Fermer"
      >
        <IoMdClose size={18} />
      </button>
    </header>
  );
};

Modal.Trigger = Trigger;
Modal.Window = Window;
Modal.WindowHeader = WindowHeader;

export default Modal;
