import { getDB } from "../config/mongo.js";

// Câu 1: Thống kê doanh thu theo tháng (Thành viên 1)
const getMonthlyRevenue = async () => {
  try {
    return await getDB().collection("orders").aggregate([
      // --- DÁN CODE TỪ COMPASS VÀO ĐÂY ---
      { $match: { status: "delivered" } },
      { $group: {
          _id: { Thang: { $month: "$createAt" }, Nam: { $year: "$createAt" } },
          DoanhThu: { $sum: "$totalPriceOrder" },
          SoDon: { $sum: 1 }
      }},
      { $sort: { "_id.Nam": 1, "_id.Thang": 1 } }
      // ------------------------------------
    ]).toArray();
  } catch (error) { throw new Error(error); }
};

// Câu 2: Top 5 Sản phẩm bán chạy (Thành viên 2)
const getTopSellingProducts = async () => {
  try {
    return await getDB().collection("orders").aggregate([
      // --- DÁN CODE TỪ COMPASS VÀO ĐÂY ---
      { $match: { status: "delivered" } },
      { $unwind: "$listProduct" },
      { $group: {
          _id: "$listProduct.productId",
          TenSP: { $first: "$listProduct.name" },
          DaBan: { $sum: "$listProduct.quantity" }
      }},
      { $sort: { DaBan: -1 } },
      { $limit: 5 }
      // ------------------------------------
    ]).toArray();
  } catch (error) { throw new Error(error); }
};


export const statisticModel = {
  getMonthlyRevenue,
  getTopSellingProducts
};