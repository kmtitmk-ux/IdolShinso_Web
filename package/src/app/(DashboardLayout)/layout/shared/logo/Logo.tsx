import Link from "next/link";
import { styled } from "@mui/material";
import Image from "next/image";

const LinkStyled = styled(Link)(() => ({
  height: "70px",
  width: "180px",
  overflow: "hidden",
  display: "block",
}));

const Logo = () => {
  return (
    <LinkStyled href="/">
      <Image src="/images/logos/logo.svg" alt="logo" height={106} width={379} fill style={{ objectFit: 'contain' }} priority />
    </LinkStyled>
  );
};

export default Logo;
