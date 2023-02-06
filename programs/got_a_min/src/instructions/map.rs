use anchor_lang::prelude::*;

use crate::state::{map::*, Map};
use crate::instructions::location;
use crate::errors::ValidationError;

#[derive(Accounts)]
pub struct InitMap<'info> {
    #[account(init, payer = owner, space = Map::LEN)]
    pub map: Account<'info, Map>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn init(ctx: Context<InitMap>) -> Result<()> {
    let map: &mut Account<Map> = &mut ctx.accounts.map;
    let owner: &Signer = &ctx.accounts.owner;

    map.owner = owner.key();
    map.row_ptrs = [0; ROW_PTR_MAX];
    map.columns = [0; COL_MAX];
    map.values = [0; COL_MAX];

    map.width = 6;
    map.height = 5;

    // RP => 0248
    map.row_ptrs[1] = 2;
    map.row_ptrs[2] = 4;
    map.row_ptrs[3] = 8;

    // C  => 2312012512345
    map.columns[0] = 2;
    map.columns[1] = 3;
    map.columns[2] = 1;
    map.columns[3] = 2;
    map.columns[4] = 0;
    map.columns[5] = 1;
    map.columns[6] = 2;
    map.columns[7] = 5;
    map.columns[8] = 1;
    map.columns[9] = 2;
    map.columns[10] = 3;
    map.columns[11] = 4;
    map.columns[12] = 5;

    // V  => 3121421351421
    map.values[0] = 3;
    map.values[1] = 1;
    map.values[2] = 2;
    map.values[3] = 1;
    map.values[4] = 4;
    map.values[5] = 2;
    map.values[6] = 1;
    map.values[7] = 3;
    map.values[8] = 5;
    map.values[9] = 1;
    map.values[10] = 4;
    map.values[11] = 2;
    map.values[12] = 1;

    Ok(())
}

#[derive(Accounts)]
pub struct MapPut<'info> {
    #[account(mut)]
    pub map: Account<'info, Map>,
}

pub fn put(ctx: Context<MapPut>, x: u8, y: u8, num: u8) -> Result<()> {
    let map = &mut ctx.accounts.map;

    put_2(
        map, 
        x, 
        y, 
        num,
    );
    Ok(())
}

fn put_2(
    map: &mut Account<Map>,
    x: u8,
    y: u8,
    new_value: u8,
) {
    let mut row_ptrs: Vec<u8> = map.row_ptrs.to_vec();
    let mut columns: Vec<u8> = map.columns.to_vec();
    let mut values: Vec<u8> = map.values.to_vec();
    //let xu = x as usize;
    let yu = y as usize;
    let mut new_width = map.width;
    let mut new_height = map.height;

    let (i_opt, insert_point_opt) = value_ptr(&row_ptrs, &columns, &values, x, y);
    if i_opt.is_some() {
        values[i_opt.unwrap() as usize] = new_value;
    } else {
        if insert_point_opt.is_some() {
            let insert_point = insert_point_opt.unwrap() as usize;
            columns.insert(insert_point, x);
            values.insert(insert_point, new_value);

            let row_ptrs_len: u8 = row_ptrs.len() as u8;
            if y < row_ptrs_len {
                let mut rp_val_next = columns.len() as u8;
                if y + 1 < row_ptrs_len {
                    rp_val_next = row_ptrs[(y + 1) as usize];
                }
                for i in yu + 1..row_ptrs.len() {
                    let new_rp_val = row_ptrs[i] + 1;
                    row_ptrs.splice(i..i + 1, [new_rp_val]);
                }
            }

            if x >= new_width {
                new_width = x + 1;
            }
        } else {
            let x_diff = (x + 1) - new_width;
            if x_diff > 0 {
                new_width += x_diff;
            }

            let y_diff = (y + 1) - new_height;

            for _add_y in new_height..y + 1 {
                row_ptrs.push(columns.len() as u8);
                columns.push(0);
                values.push(0);
            }

            if y_diff > 0 {
                row_ptrs.push(columns.len() as u8);
                columns.push(x);
                values.push(new_value);
                new_height += y_diff;
            }
        }

        map.width = new_width;
        map.height = new_height;
    }
}

// Need to handle trailing 0 value in fixed size array
// Need to limit how much the array can grow
// Eventually might change the compressed value to space instead of unexplored if count of space > unexplored
fn value_ptr(row_ptrs: &Vec<u8>, columns: &Vec<u8>, values: &Vec<u8>, x: u8, y: u8) -> (Option<u8>, Option<u8>) {
    let mut value_index = None;
    let mut insert_point = None;
    if y < row_ptrs.len() as u8 {
        let rp_val = row_ptrs[y as usize];
        let mut rp_val_next = columns.len() as u8;
        if y + 1 < row_ptrs.len() as u8 {
            rp_val_next = row_ptrs[(y + 1) as usize];
        }
        let mut check_col_subset = false;
        let mut x_in_column = 0;
        for col_subset_pos in rp_val..rp_val_next {
            if x == columns[col_subset_pos as usize] {
                x_in_column = col_subset_pos;
                check_col_subset = true;
                break;
            } else if x < columns[col_subset_pos as usize] {
                insert_point = Some(col_subset_pos);
                break;
            } else if col_subset_pos == rp_val_next - 1 {
                insert_point = Some(col_subset_pos + 1);
            }
        }
        let check_minimum = check_col_subset;
        let check_max_per_row_or_end = x_in_column <= rp_val_next;
        if check_minimum && check_max_per_row_or_end {
            let c = x_in_column;
            if c < values.len() as u8 {
                value_index = Some(c);
            }
        }
    }
    (value_index, insert_point)
}



/*
  valuePtr(x: number, y: number): [number, number] {
      let valueIndex = -1;
      let insertPoint = -1;
      if(y < this.rowPtrs.length) {
          let rpVal = this.rowPtrs[y];
          let rpValNext = this.columns.length;
          if(y+1 < this.rowPtrs.length) {
              rpValNext = this.rowPtrs[y+1];
          }
          let checkColSubset = false;
          let xInColumn = 0;
          //let colSubset = "";
          for(let colSubsetPos = rpVal; colSubsetPos < rpValNext; colSubsetPos++) {
              //colSubset += this.columns[colSubsetPos];
              if(x == this.columns[colSubsetPos]) {
                  xInColumn = colSubsetPos;
                  checkColSubset = true;
                  break;
              } else if(x < this.columns[colSubsetPos]) {
                  insertPoint = colSubsetPos;
                  break;
              } else if(colSubsetPos == rpValNext - 1) {
                  //console.log("colSubsetPos end: ", colSubsetPos);
                  insertPoint = colSubsetPos + 1;
              }
          }

          let checkMinimum = xInColumn >= 0 && checkColSubset;
          let checkMaxPerRowOrEnd = (xInColumn <= rpValNext);
          if(checkMinimum && checkMaxPerRowOrEnd) {
              let c = xInColumn;
              if(c < this.values.length) {
                  valueIndex = c;
              }
          }
          //console.log("valueIndex", valueIndex, "rpVal", rpVal, "x2", x2, "colSubset", colSubset);
      }
      return [valueIndex, insertPoint];
  }

*/

