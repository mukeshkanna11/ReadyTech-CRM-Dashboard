import { useState } from "react";
import API from "../services/api";
import toast from "react-hot-toast";

export default function PaymentModal({ invoiceId, close }) {
  const [amount, setAmount] = useState("");

  const submitPayment = async () => {
    await API.post(`/invoices/${invoiceId}/payment`, {
      amount: Number(amount),
      method: "Cash",
    });

    toast.success("Payment Added");
    close();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <div className="p-6 bg-white rounded-lg w-80">
        <h2 className="mb-4 text-lg font-bold">Add Payment</h2>

        <input
          type="number"
          placeholder="Enter Amount"
          className="w-full p-2 mb-3 border"
          onChange={(e) => setAmount(e.target.value)}
        />

        <button
          onClick={submitPayment}
          className="px-4 py-2 text-white bg-green-600 rounded"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
