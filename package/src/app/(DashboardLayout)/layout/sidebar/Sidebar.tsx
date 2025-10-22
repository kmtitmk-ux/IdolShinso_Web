import { useMediaQuery, Box, Drawer } from "@mui/material";
import SidebarItems from "./SidebarItems";

type LangCode = "ja" | "en" | "zh-TW";
interface ItemType {
    isMobileSidebarOpen: boolean;
    onSidebarClose: (event: React.MouseEvent<HTMLElement>) => void;
    isSidebarOpen: boolean;
    lang: LangCode;
}
const MSidebar = ({
    isMobileSidebarOpen = false,
    onSidebarClose = () => { },
    isSidebarOpen = true,
    lang
}: ItemType) => {
    const lgUp = useMediaQuery((theme: any) => theme.breakpoints?.up("lg"));
    const sidebarWidth = "270px";
    // Custom CSS for short scrollbar
    const scrollbarStyles = {
        '&::-webkit-scrollbar': {
            width: '7px',

        },
        '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#eff2f7',
            borderRadius: '15px',
        },
    };

    if (lgUp) {
        return (
            <Box
                sx={{
                    width: sidebarWidth,
                    flexShrink: 0,
                }}
            >
                {/* ------------------------------------------- */}
                {/* Sidebar for desktop */}
                {/* ------------------------------------------- */}
                <Drawer
                    anchor="left"
                    open={isSidebarOpen}
                    variant="permanent"
                    slotProps={{
                        paper: {
                            sx: {
                                boxSizing: "border-box",
                                ...scrollbarStyles,
                                width: sidebarWidth,
                            },
                        }
                    }}
                >
                    {/* ------------------------------------------- */}
                    {/* Sidebar Box */}
                    {/* ------------------------------------------- */}
                    <Box sx={{ height: "100%" }}>
                        <Box>
                            {/* ------------------------------------------- */}
                            {/* Sidebar Items */}
                            {/* ------------------------------------------- */}
                            <SidebarItems lang={lang} />
                        </Box>
                    </Box>
                </Drawer>
            </Box >
        );
    }

    return (
        <Drawer
            anchor="left"
            open={isMobileSidebarOpen}
            onClose={onSidebarClose}
            variant="temporary"
            slotProps={{
                paper: {
                    sx: {
                        boxShadow: (theme) => theme.shadows[8],
                        ...scrollbarStyles,
                    },
                }
            }}
        >
            {/* ------------------------------------------- */}
            {/* Sidebar Box */}
            {/* ------------------------------------------- */}
            <Box>
                {/* ------------------------------------------- */}
                {/* Sidebar Items */}
                {/* ------------------------------------------- */}
                <SidebarItems lang={lang} />
            </Box>
            {/* ------------------------------------------- */}
            {/* Sidebar For Mobile */}
            {/* ------------------------------------------- */}
        </Drawer>
    );
};

export default MSidebar;