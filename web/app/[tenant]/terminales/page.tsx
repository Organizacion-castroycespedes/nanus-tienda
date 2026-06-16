import { redirect } from "next/navigation";

const LegacyTerminalesRedirectPage = ({
  params,
}: {
  params: { tenant: string };
}) => {
  redirect(`/${params.tenant}/config/terminals`);
};

export default LegacyTerminalesRedirectPage;
