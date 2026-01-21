import { NavLink, Outlet } from "react-router-dom";

export default function ERPLayout() {
  return (
    <div className="flex h-screen">
      <aside className="w-64 p-4 text-white bg-gray-900">
        <h2 className="mb-6 text-xl font-bold">ERP</h2>
        <nav className="space-y-2">
          <NavLink to="products">Products</NavLink><br />
          <NavLink to="warehouses">Warehouses</NavLink><br />
          <NavLink to="vendors">Vendors</NavLink><br />
          <NavLink to="purchase">Purchase Orders</NavLink><br />
          <NavLink to="sales">Sales Orders</NavLink><br />
          <NavLink to="inventory">Inventory</NavLink>
        </nav>
      </aside>

      <main className="flex-1 p-6 overflow-auto bg-gray-100">
        <Outlet />
      </main>
    </div>
  );
}
