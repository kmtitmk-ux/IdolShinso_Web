"use client";
import React, { useState } from 'react';
import { usePathname, useRouter } from "next/navigation";
import {
    AppBar,
    Toolbar,
    styled,
    Stack,
    IconButton,
    Badge,
    Box,
    Button,
    useMediaQuery,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent
} from '@mui/material';
import PropTypes from 'prop-types';
import Link from 'next/link';
// components
import Profile from './Profile';
import { IconBellRinging, IconMenu } from '@tabler/icons-react';

type LangCode = "ja" | "en" | "zh-TW";
interface ItemType {
    toggleMobileSidebar?: (event: React.MouseEvent<HTMLElement>) => void;
    lang: LangCode;
}
const langLabels: Record<LangCode, string> = {
    ja: "言語",
    en: "Language",
    "zh-TW": "語言",
};
const Header = ({ toggleMobileSidebar = () => { }, lang }: ItemType) => {
    const lgUp = useMediaQuery((theme) => theme.breakpoints.up('lg'));
    const lgDown = useMediaQuery((theme) => theme.breakpoints.down('lg'));
    const router = useRouter();
    const languages = [
        { code: "ja", native: "日本語", english: "Japanese" },
        { code: "en", native: "English", english: "English" },
        { code: "zh-TW", native: "繁體中文", english: "Chinese (Traditional)" },
    ];
    const AppBarStyled = styled(AppBar)(({ theme }) => ({
        boxShadow: 'none',
        background: theme.palette.background.paper,
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        [theme.breakpoints.up('lg')]: {
            minHeight: '70px',
        },
    }));
    const ToolbarStyled = styled(Toolbar)(({ theme }) => ({
        width: '100%',
        color: theme.palette.text.secondary,
    }));
    const handleChange = (event: SelectChangeEvent): void => {
        router.push(`/${event.target.value}`);
    };
    return (
        <AppBarStyled position="sticky" color="default">
            <ToolbarStyled>
                <IconButton
                    color="inherit"
                    aria-label="menu"
                    onClick={toggleMobileSidebar}
                    sx={{
                        display: {
                            lg: "none",
                            xs: "inline",
                        },
                    }}
                >
                    <IconMenu width="20" height="20" />
                </IconButton>
                {/* <IconButton
                    size="large"
                    aria-label="show 11 new notifications"
                    color="inherit"
                    aria-controls="msgs-menu"
                    aria-haspopup="true"
                >
                    <Badge variant="dot" color="primary">
                        <IconBellRinging size="21" stroke="1.5" />
                    </Badge>
                </IconButton> */}
                <Box flexGrow={1} />
                <Box sx={{ minWidth: 120 }}>
                    <FormControl fullWidth>
                        <InputLabel id="lang-select-label">{langLabels[lang]}</InputLabel>
                        <Select
                            labelId="lang-select-label"
                            id="lang-select"
                            value={lang}
                            label="Age"
                            onChange={handleChange}
                        >
                            {languages.map((item, i) => <MenuItem key={i} value={item.code}>{item.native}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Box>
                {/* <Stack spacing={1} direction="row" alignItems="center">
                    <Button variant="contained" component={Link} href="/authentication/login" disableElevation color="primary">
                        Login
                    </Button>
                    <Profile />
                </Stack> */}
            </ToolbarStyled>
        </AppBarStyled>
    );
};

Header.propTypes = {
    sx: PropTypes.object,
};

export default Header;
