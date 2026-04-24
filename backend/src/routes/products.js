'use strict';

const express = require('express');
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function buildProductFromBody(body) {
  return {
    id: body.id || slugify(body.nome),
    ordem: body.ordem ? parseInt(body.ordem, 10) : null,
    nome: body.nome,
    categoria: body.categoria,
    subcategoria: body.subcategoria || null,
    preco: parseFloat(body.preco),
    imagem: body.imagem || null,
    descricao: body.descricao || null,
    notas: body.notas || null,
    harmonizacao: body.harmonizacao || null,
    destaque: body.destaque === true || body.destaque === 'true',
    produtor: body.produtor || null,
    ativo: body.ativo === undefined ? true : (body.ativo === true || body.ativo === 'true'),
    // Wine fields
    uva: body.uva || null,
    safra: body.safra || null,
    teor: body.teor || null,
    volume: body.volume || null,
    regiao: body.regiao || null,
    temperatura: body.temperatura || null,
    guarda: body.guarda || null,
    // Chocolate fields
    peso: body.peso || null,
    cacau: body.cacau || null,
    origem: body.origem || null,
    alcool: body.alcool === true || body.alcool === 'true',
    alergenos: Array.isArray(body.alergenos) ? body.alergenos : [],
  };
}

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const {
      categoria,
      subcategoria,
      destaque,
      ativo,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (categoria) {
      conditions.push(`categoria = $${paramIndex++}`);
      params.push(categoria);
    }

    if (subcategoria) {
      conditions.push(`subcategoria = $${paramIndex++}`);
      params.push(subcategoria);
    }

    if (destaque !== undefined) {
      conditions.push(`destaque = $${paramIndex++}`);
      params.push(destaque === 'true');
    }

    if (ativo !== undefined) {
      conditions.push(`ativo = $${paramIndex++}`);
      params.push(ativo === 'true');
    }

    if (search) {
      conditions.push(
        `(nome ILIKE $${paramIndex} OR descricao ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) FROM products ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    params.push(limitNum);
    params.push(offset);

    const productsResult = await query(
      `SELECT * FROM products ${whereClause}
       ORDER BY COALESCE(ordem, 9999), nome
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    // Stats by category
    const statsResult = await query(`
      SELECT
        COUNT(*) FILTER (WHERE ativo = true) AS total_ativo,
        COUNT(*) FILTER (WHERE categoria = 'vinhos') AS total_vinhos,
        COUNT(*) FILTER (WHERE categoria = 'chocolates') AS total_chocolates,
        COUNT(*) FILTER (WHERE categoria = 'presentes') AS total_presentes,
        COUNT(*) AS total
      FROM products
    `);

    return res.json({
      products: productsResult.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      stats: statsResult.rows[0],
    });
  } catch (err) {
    console.error('List products error:', err);
    return res.status(500).json({ error: 'Erro ao buscar produtos.' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM products WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    return res.json({ product: result.rows[0] });
  } catch (err) {
    console.error('Get product error:', err);
    return res.status(500).json({ error: 'Erro ao buscar produto.' });
  }
});

// POST /api/products
router.post('/', async (req, res) => {
  try {
    const { nome, categoria, preco } = req.body;

    if (!nome || !categoria || preco === undefined) {
      return res.status(400).json({
        error: 'Campos obrigatórios: nome, categoria, preco.',
      });
    }

    const validCategorias = ['vinhos', 'chocolates', 'presentes'];
    if (!validCategorias.includes(categoria)) {
      return res.status(400).json({
        error: `Categoria inválida. Use: ${validCategorias.join(', ')}.`,
      });
    }

    const p = buildProductFromBody(req.body);

    const result = await query(
      `INSERT INTO products (
        id, ordem, nome, categoria, subcategoria, preco, imagem, descricao,
        notas, harmonizacao, destaque, produtor, ativo,
        uva, safra, teor, volume, regiao, temperatura, guarda,
        peso, cacau, origem, alcool, alergenos
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25
      ) RETURNING *`,
      [
        p.id, p.ordem, p.nome, p.categoria, p.subcategoria, p.preco, p.imagem, p.descricao,
        p.notas, p.harmonizacao, p.destaque, p.produtor, p.ativo,
        p.uva, p.safra, p.teor, p.volume, p.regiao, p.temperatura, p.guarda,
        p.peso, p.cacau, p.origem, p.alcool, p.alergenos,
      ]
    );

    return res.status(201).json({ product: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe um produto com este ID/slug.' });
    }
    console.error('Create product error:', err);
    return res.status(500).json({ error: 'Erro ao criar produto.' });
  }
});

// PUT /api/products/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await query('SELECT id FROM products WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    const { nome, categoria, preco } = req.body;

    if (!nome || !categoria || preco === undefined) {
      return res.status(400).json({
        error: 'Campos obrigatórios: nome, categoria, preco.',
      });
    }

    const validCategorias = ['vinhos', 'chocolates', 'presentes'];
    if (!validCategorias.includes(categoria)) {
      return res.status(400).json({
        error: `Categoria inválida. Use: ${validCategorias.join(', ')}.`,
      });
    }

    const p = buildProductFromBody(req.body);

    const result = await query(
      `UPDATE products SET
        ordem = $1, nome = $2, categoria = $3, subcategoria = $4, preco = $5,
        imagem = $6, descricao = $7, notas = $8, harmonizacao = $9,
        destaque = $10, produtor = $11, ativo = $12,
        uva = $13, safra = $14, teor = $15, volume = $16, regiao = $17,
        temperatura = $18, guarda = $19,
        peso = $20, cacau = $21, origem = $22, alcool = $23, alergenos = $24
      WHERE id = $25
      RETURNING *`,
      [
        p.ordem, p.nome, p.categoria, p.subcategoria, p.preco,
        p.imagem, p.descricao, p.notas, p.harmonizacao,
        p.destaque, p.produtor, p.ativo,
        p.uva, p.safra, p.teor, p.volume, p.regiao,
        p.temperatura, p.guarda,
        p.peso, p.cacau, p.origem, p.alcool, p.alergenos,
        req.params.id,
      ]
    );

    return res.json({ product: result.rows[0] });
  } catch (err) {
    console.error('Update product error:', err);
    return res.status(500).json({ error: 'Erro ao atualizar produto.' });
  }
});

// DELETE /api/products/:id — soft delete
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'UPDATE products SET ativo = false WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    return res.json({ message: 'Produto desativado com sucesso.' });
  } catch (err) {
    console.error('Delete product error:', err);
    return res.status(500).json({ error: 'Erro ao desativar produto.' });
  }
});

// PATCH /api/products/:id/toggle — toggle ativo field
router.patch('/:id/toggle', async (req, res) => {
  try {
    const result = await query(
      'UPDATE products SET ativo = NOT ativo WHERE id = $1 RETURNING id, ativo',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    const product = result.rows[0];
    return res.json({
      message: `Produto ${product.ativo ? 'ativado' : 'desativado'} com sucesso.`,
      ativo: product.ativo,
    });
  } catch (err) {
    console.error('Toggle product error:', err);
    return res.status(500).json({ error: 'Erro ao alternar status do produto.' });
  }
});

module.exports = router;
