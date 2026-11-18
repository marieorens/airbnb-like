import React, { Suspense } from "react";
import Logo from "./Logo";
import Search from "./Search";
import UserMenu from "./UserMenu";
import MessagesLink from "./MessagesLink";
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
      userMenu={
        <div className="flex items-center gap-2">
          <MessagesLink userId={user?.id} />
          <UserMenu user={user} />
        </div>
      }
      categories={null}
    />
  );
};

export default Navbar;
