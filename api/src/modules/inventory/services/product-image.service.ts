import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ProductCategoryRepository } from "../repositories/product-category.repository";
import { ProductRepository } from "../repositories/product.repository";
import { ProductSubcategoryRepository } from "../repositories/product-subcategory.repository";
import {
  LocalImageStorageService,
  type InventoryImageMimeType,
  type ReadInventoryImage,
  type UploadedInventoryImageFile,
} from "./local-image-storage.service";

@Injectable()
export class ProductImageService {
  constructor(
    @Inject(LocalImageStorageService)
    private readonly storage: LocalImageStorageService,
    @Inject(ProductRepository)
    private readonly productRepository: ProductRepository,
    @Inject(ProductCategoryRepository)
    private readonly categoryRepository: ProductCategoryRepository,
    @Inject(ProductSubcategoryRepository)
    private readonly subcategoryRepository: ProductSubcategoryRepository
  ) {}

  async uploadProductImage(
    tenantId: string,
    productId: string,
    file: UploadedInventoryImageFile | undefined,
    altText?: string | null
  ) {
    const product = await this.productRepository.findById(productId, tenantId);
    if (!product) {
      throw new NotFoundException("product not found");
    }

    const previousStorageKey = product.imageStorageKey;
    const saved = await this.storage.saveImage({
      target: "products",
      tenantId,
      ownerId: productId,
      file,
      maxSizeMb: this.storage.getProductMaxSizeMb(),
    });

    try {
      const updated = await this.productRepository.update(productId, tenantId, {
        imageUrl: this.storage.buildImageUrl("products", productId),
        imageStorageKey: saved.storageKey,
        imageAltText: this.normalizeAltText(altText, product.name),
        imageMimeType: saved.mimeType,
        imageSizeBytes: saved.sizeBytes,
        imageUpdatedAt: new Date(),
      });
      if (!updated) {
        throw new NotFoundException("product not found");
      }
      await this.deletePreviousImage(previousStorageKey, saved.storageKey);
      return updated;
    } catch (error) {
      await this.storage.deleteImage(saved.storageKey);
      throw error;
    }
  }

  async deleteProductImage(tenantId: string, productId: string) {
    const product = await this.productRepository.findById(productId, tenantId);
    if (!product) {
      throw new NotFoundException("product not found");
    }

    const previousStorageKey = product.imageStorageKey;
    const updated = await this.productRepository.update(productId, tenantId, {
      imageUrl: null,
      imageStorageKey: null,
      imageAltText: null,
      imageMimeType: null,
      imageSizeBytes: null,
      imageUpdatedAt: null,
    });
    if (!updated) {
      throw new NotFoundException("product not found");
    }

    await this.storage.deleteImage(previousStorageKey);
    return updated;
  }

  async readProductImage(
    tenantId: string,
    productId: string
  ): Promise<ReadInventoryImage> {
    const product = await this.productRepository.findById(productId, tenantId);
    if (!product?.imageStorageKey || !product.imageMimeType) {
      throw new NotFoundException("product image not found");
    }

    return this.storage.readImage(
      product.imageStorageKey,
      product.imageMimeType as InventoryImageMimeType
    );
  }

  async uploadCategoryImage(
    tenantId: string,
    categoryId: string,
    file: UploadedInventoryImageFile | undefined,
    altText?: string | null
  ) {
    const category = await this.categoryRepository.findById(
      tenantId,
      categoryId
    );
    if (!category) {
      throw new NotFoundException("product category not found");
    }

    const previousStorageKey = category.defaultImageStorageKey;
    const saved = await this.storage.saveImage({
      target: "product-categories",
      tenantId,
      ownerId: categoryId,
      file,
      maxSizeMb: this.storage.getCategoryMaxSizeMb(),
    });

    try {
      const updated = await this.categoryRepository.update(tenantId, categoryId, {
        defaultImageUrl: this.storage.buildImageUrl(
          "product-categories",
          categoryId
        ),
        defaultImageStorageKey: saved.storageKey,
        defaultImageAltText: this.normalizeAltText(altText, category.name),
        defaultImageMimeType: saved.mimeType,
        defaultImageSizeBytes: saved.sizeBytes,
      });
      if (!updated) {
        throw new NotFoundException("product category not found");
      }
      await this.deletePreviousImage(previousStorageKey, saved.storageKey);
      return updated;
    } catch (error) {
      await this.storage.deleteImage(saved.storageKey);
      throw error;
    }
  }

  async deleteCategoryImage(tenantId: string, categoryId: string) {
    const category = await this.categoryRepository.findById(
      tenantId,
      categoryId
    );
    if (!category) {
      throw new NotFoundException("product category not found");
    }

    const previousStorageKey = category.defaultImageStorageKey;
    const updated = await this.categoryRepository.update(tenantId, categoryId, {
      defaultImageUrl: null,
      defaultImageStorageKey: null,
      defaultImageAltText: null,
      defaultImageMimeType: null,
      defaultImageSizeBytes: null,
    });
    if (!updated) {
      throw new NotFoundException("product category not found");
    }

    await this.storage.deleteImage(previousStorageKey);
    return updated;
  }

  async readCategoryImage(
    tenantId: string,
    categoryId: string
  ): Promise<ReadInventoryImage> {
    const category = await this.categoryRepository.findById(
      tenantId,
      categoryId
    );
    if (!category?.defaultImageStorageKey || !category.defaultImageMimeType) {
      throw new NotFoundException("product category image not found");
    }

    return this.storage.readImage(
      category.defaultImageStorageKey,
      category.defaultImageMimeType as InventoryImageMimeType
    );
  }

  async uploadSubcategoryImage(
    tenantId: string,
    subcategoryId: string,
    file: UploadedInventoryImageFile | undefined,
    altText?: string | null
  ) {
    const subcategory = await this.subcategoryRepository.findById(
      tenantId,
      subcategoryId
    );
    if (!subcategory) {
      throw new NotFoundException("product subcategory not found");
    }

    const previousStorageKey = subcategory.defaultImageStorageKey;
    const saved = await this.storage.saveImage({
      target: "product-subcategories",
      tenantId,
      ownerId: subcategoryId,
      file,
      maxSizeMb: this.storage.getCategoryMaxSizeMb(),
    });

    try {
      const updated = await this.subcategoryRepository.update(
        tenantId,
        subcategoryId,
        {
          defaultImageUrl: this.storage.buildImageUrl(
            "product-subcategories",
            subcategoryId
          ),
          defaultImageStorageKey: saved.storageKey,
          defaultImageAltText: this.normalizeAltText(
            altText,
            subcategory.name
          ),
          defaultImageMimeType: saved.mimeType,
          defaultImageSizeBytes: saved.sizeBytes,
        }
      );
      if (!updated) {
        throw new NotFoundException("product subcategory not found");
      }
      await this.deletePreviousImage(previousStorageKey, saved.storageKey);
      return updated;
    } catch (error) {
      await this.storage.deleteImage(saved.storageKey);
      throw error;
    }
  }

  async deleteSubcategoryImage(tenantId: string, subcategoryId: string) {
    const subcategory = await this.subcategoryRepository.findById(
      tenantId,
      subcategoryId
    );
    if (!subcategory) {
      throw new NotFoundException("product subcategory not found");
    }

    const previousStorageKey = subcategory.defaultImageStorageKey;
    const updated = await this.subcategoryRepository.update(
      tenantId,
      subcategoryId,
      {
        defaultImageUrl: null,
        defaultImageStorageKey: null,
        defaultImageAltText: null,
        defaultImageMimeType: null,
        defaultImageSizeBytes: null,
      }
    );
    if (!updated) {
      throw new NotFoundException("product subcategory not found");
    }

    await this.storage.deleteImage(previousStorageKey);
    return updated;
  }

  async readSubcategoryImage(
    tenantId: string,
    subcategoryId: string
  ): Promise<ReadInventoryImage> {
    const subcategory = await this.subcategoryRepository.findById(
      tenantId,
      subcategoryId
    );
    if (
      !subcategory?.defaultImageStorageKey ||
      !subcategory.defaultImageMimeType
    ) {
      throw new NotFoundException("product subcategory image not found");
    }

    return this.storage.readImage(
      subcategory.defaultImageStorageKey,
      subcategory.defaultImageMimeType as InventoryImageMimeType
    );
  }

  private normalizeAltText(value: string | null | undefined, fallback: string) {
    return value?.trim() || fallback;
  }

  private async deletePreviousImage(
    previousStorageKey: string | null,
    currentStorageKey: string
  ) {
    if (previousStorageKey && previousStorageKey !== currentStorageKey) {
      await this.storage.deleteImage(previousStorageKey);
    }
  }
}
