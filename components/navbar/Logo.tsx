import React from "react";
import Image from "next/image";
import Link from "next/link";

const Logo = () => {
  return (
    <Link href="/" className="relative block h-[31px] w-[132px] shrink-0 sm:h-[35px] sm:w-[150px]">
      <Image
        src="/images/vacationhub.png"
        alt="logo"
        fill
        sizes="150px"
        priority
        unoptimized
      />
    </Link>
  );
};

export default Logo;
