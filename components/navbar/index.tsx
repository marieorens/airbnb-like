import React, { Suspense } from "react";
import Logo from "./Logo";
import Search from "./Search";
import UserMenu from "./UserMenu";
import NavbarShell from "./NavbarShell";
import { getCurrentUser } from "@/services/user";

interface NavbarProps {}

const Navbar: React.FC<NavbarProps> = async () => {
  const user = await getCurrentUser();

  return (
    <NavbarShell
      logo={<Logo />}
      search={
        <Suspense fallback={<></>}>
          <Search />
        </Suspense>
      }
      userMenu={<UserMenu user={user} />}
      categories={null}
    />
  );
};

export default Navbar;
