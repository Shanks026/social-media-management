import { createContext, useContext, useState } from "react";

const HeaderContext = createContext(null);

export function HeaderProvider({ children }) {
    const [header, setHeader] = useState({
        title: null,
        breadcrumbs: [],
        actions: null,
    });

    return (
        <HeaderContext.Provider value={{ header, setHeader }}>
            {children}
        </HeaderContext.Provider>
    );
}

export function useHeader() {
    const ctx = useContext(HeaderContext);
    if (!ctx) {
        throw new Error("useHeader must be used within HeaderProvider");
    }
    return ctx;
}
